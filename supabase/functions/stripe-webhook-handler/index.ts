import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('Missing Stripe signature');
      return new Response('Missing signature', { status: 400, headers: corsHeaders });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    if (!stripeSecretKey || !webhookSecret) {
      console.error('Missing Stripe configuration');
      return new Response('Configuration error', { status: 500, headers: corsHeaders });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    
    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400, headers: corsHeaders });
    }

    console.log(`Processing Stripe webhook: ${event.type}`);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Process relevant events for referral rewards
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Checkout completed: ${session.id}, customer: ${session.customer}`);
        
        if (session.customer && session.payment_status === 'paid') {
          await processFirstPayment(supabaseClient, session.customer as string);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice paid: ${invoice.id}, customer: ${invoice.customer}`);
        
        if (invoice.customer && invoice.billing_reason === 'subscription_create') {
          // First subscription payment
          await processFirstPayment(supabaseClient, invoice.customer as string);
        }
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription created: ${subscription.id}, customer: ${subscription.customer}`);
        
        if (subscription.status === 'active') {
          await processFirstPayment(supabaseClient, subscription.customer as string);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processFirstPayment(supabaseClient: any, customerId: string) {
  try {
    console.log(`Processing first payment for customer: ${customerId}`);

    // Find user by Stripe customer ID
    const { data: subscribers, error: subscribersError } = await supabaseClient
      .from('subscribers')
      .select('user_id, email')
      .eq('stripe_customer_id', customerId)
      .limit(1);

    if (subscribersError || !subscribers || subscribers.length === 0) {
      console.log(`No subscriber found for customer: ${customerId}`);
      return;
    }

    const userId = subscribers[0].user_id;
    console.log(`Found user: ${userId} for customer: ${customerId}`);

    // Check if user has any referrals where they are the referred user
    const { data: referrals, error: referralsError } = await supabaseClient
      .from('referrals')
      .select('id, referrer_id, status')
      .eq('referred_user_id', userId)
      .eq('status', 'pending')
      .limit(1);

    if (referralsError) {
      console.error('Error checking referrals:', referralsError);
      return;
    }

    if (!referrals || referrals.length === 0) {
      console.log(`No pending referrals found for user: ${userId}`);
      return;
    }

    const referral = referrals[0];
    console.log(`Processing referral reward: ${referral.id}`);

    // Trigger referral reward processing
    const { error: rewardError } = await supabaseClient.functions.invoke('process-referral-rewards', {
      body: {
        referralId: referral.id,
        eventType: 'first_payment'
      }
    });

    if (rewardError) {
      console.error('Error processing referral reward:', rewardError);
    } else {
      console.log(`Referral reward processed successfully for referral: ${referral.id}`);
    }

  } catch (error) {
    console.error('Error in processFirstPayment:', error);
  }
}