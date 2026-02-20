import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { referralId, eventType } = await req.json();
    
    console.log(`Processing referral reward: ${referralId}, event: ${eventType}`);

    // Get referral details
    const { data: referral, error: referralError } = await supabaseClient
      .from('referrals')
      .select(`
        *,
        referrer:referrer_id(id, email),
        referred:referred_user_id(id, email)
      `)
      .eq('id', referralId)
      .single();

    if (referralError || !referral) {
      console.error('Referral not found:', referralError);
      return new Response(JSON.stringify({ error: 'Referral not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current referral configuration
    const { data: config, error: configError } = await supabaseClient
      .rpc('get_active_referral_configuration');

    if (configError || !config) {
      console.error('Referral configuration not found:', configError);
      return new Response(JSON.stringify({ error: 'Referral configuration not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let rewardAmount = 0;
    let rewardType = 'signup_bonus';

    // Determine reward based on event type
    switch (eventType) {
      case 'user_signup':
        // Friend gets discount, referrer gets pending bonus
        rewardAmount = config.referral_bonus_amount;
        rewardType = 'signup_bonus';
        break;
      case 'first_payment':
        // Convert pending to earned and add payment bonus if any
        rewardAmount = config.referral_bonus_amount;
        rewardType = 'payment_bonus';
        break;
      default:
        console.log('Unknown event type:', eventType);
        return new Response(JSON.stringify({ success: true, message: 'No reward for this event' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Update referrer earnings
    const { error: earningsError } = await supabaseClient
      .from('referral_earnings')
      .upsert({
        user_id: referral.referrer_id,
        pending_amount: eventType === 'user_signup' ? rewardAmount : 0,
        total_earned: eventType === 'first_payment' ? rewardAmount : 0,
        referral_count: 1,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (earningsError) {
      console.error('Error updating referral earnings:', earningsError);
      return new Response(JSON.stringify({ error: 'Failed to update earnings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update referral status
    let referralUpdate: any = {
      updated_at: new Date().toISOString()
    };

    if (eventType === 'user_signup') {
      referralUpdate.status = 'pending';
    } else if (eventType === 'first_payment') {
      referralUpdate.status = 'completed';
      referralUpdate.completed_at = new Date().toISOString();
    }

    const { error: referralUpdateError } = await supabaseClient
      .from('referrals')
      .update(referralUpdate)
      .eq('id', referralId);

    if (referralUpdateError) {
      console.error('Error updating referral status:', referralUpdateError);
    }

    console.log(`Referral reward processed successfully: ${rewardAmount} for ${rewardType}`);

    return new Response(JSON.stringify({ 
      success: true,
      rewardAmount,
      rewardType,
      referralId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-referral-rewards:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});