
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

  try {
    if (!stripeSecret) {
      throw new Error("Stripe secret key not configured");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    // Use service role so we can also read profiles if needed and stay consistent with other functions
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) throw new Error("Unauthorized");
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const tier = body?.tier ?? "yearly";

    // Map tier to amount and label (defaults to yearly pass)
    const tierMap: Record<string, { amount: number; label: string }> = {
      yearly: { amount: 9900, label: "NotaVoice Pass (1 year)" }, // $99.00
      // Add more tiers if needed, e.g. monthly/lifetime, etc.
    };
    let { amount, label } = tierMap[tier] ?? tierMap.yearly;

    // Check for referral discount
    let discountPercentage = 0;
    let referralCode = null;

    const { data: referralData } = await supabase
      .from('referrals')
      .select('referral_code')
      .eq('referred_user_id', user.id)
      .eq('status', 'pending')
      .single();

    if (referralData) {
      // Get active referral configuration
      const { data: configData } = await supabase
        .rpc('get_active_referral_configuration');
      
      if (configData && configData.length > 0) {
        discountPercentage = configData[0].friend_discount_percentage || 0;
        referralCode = referralData.referral_code;
        
        // Apply discount to amount
        if (discountPercentage > 0) {
          const discountAmount = Math.round(amount * (discountPercentage / 100));
          amount = amount - discountAmount;
          console.log(`[create-payment] Applied ${discountPercentage}% discount, new amount: ${amount}`);
        }
      }
    }

    // Optionally fetch profile email for better customer identification
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();

    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });

    // Create one-time payment session
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id,
      customer_email: profile?.email || user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: label + (discountPercentage > 0 ? ` (${discountPercentage}% Friend Discount)` : ''),
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment-canceled`,
      metadata: {
        user_id: user.id,
        tier,
        ...(referralCode && { referral_code: referralCode })
      },
    });

    console.log("[create-payment] session created", session.id);

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[create-payment] error", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
