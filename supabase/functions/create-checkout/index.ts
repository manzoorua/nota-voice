import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { tier = 'premium' } = await req.json().catch(() => ({}));

    console.log(`Creating checkout session for user ${user.id}, tier: ${tier}`);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-06-20',
    });

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    // Check for referral discount
    let discountPercentage = 0;
    let referralCode = null;

    const { data: referralData } = await supabaseClient
      .from('referrals')
      .select('referral_code')
      .eq('referred_user_id', user.id)
      .eq('status', 'pending')
      .single();

    if (referralData) {
      // Get active referral configuration
      const { data: configData } = await supabaseClient
        .rpc('get_active_referral_configuration');
      
      if (configData && configData.length > 0) {
        discountPercentage = configData[0].friend_discount_percentage || 0;
        referralCode = referralData.referral_code;
        console.log(`Applying ${discountPercentage}% referral discount for user ${user.id}`);
      }
    }

    // Define pricing based on tier
    const priceIds = {
      premium: 'price_premium_annual', // Replace with actual Stripe price ID
      pro: 'price_pro_annual' // Replace with actual Stripe price ID
    };

    const priceId = priceIds[tier] || priceIds.premium;

    // Prepare checkout session options
    const sessionOptions = {
      customer_email: profile?.email || user.email,
      client_reference_id: user.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/billing?canceled=true`,
      metadata: {
        user_id: user.id,
        tier: tier,
        ...(referralCode && { referral_code: referralCode })
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          tier: tier,
          ...(referralCode && { referral_code: referralCode })
        }
      }
    };

    // Add discount if applicable
    if (discountPercentage > 0) {
      sessionOptions.discounts = [{
        coupon: await createOrGetCoupon(stripe, discountPercentage)
      }];
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionOptions);

    console.log(`Created checkout session: ${session.id}`);

    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout creation error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to create or get discount coupon
async function createOrGetCoupon(stripe: Stripe, discountPercentage: number): Promise<string> {
  const couponId = `referral-${discountPercentage}-percent`;
  
  try {
    // Try to retrieve existing coupon
    await stripe.coupons.retrieve(couponId);
    return couponId;
  } catch (error) {
    // Coupon doesn't exist, create it
    await stripe.coupons.create({
      id: couponId,
      name: `Referral Friend Discount (${discountPercentage}%)`,
      percent_off: discountPercentage,
      duration: 'once',
    });
    return couponId;
  }
}