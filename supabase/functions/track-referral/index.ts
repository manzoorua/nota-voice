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

    const { userId, referralCode } = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no referral code, just return success (no tracking needed)
    if (!referralCode) {
      return new Response(JSON.stringify({ success: true, message: 'No referral code provided' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing referral for user ${userId} with code ${referralCode}`);

    // Use the database function to process referral signup
    const { data: result, error: referralError } = await supabaseClient
      .rpc('process_referral_signup', {
        _referred_user_id: userId,
        _referral_code: referralCode
      });

    if (referralError) {
      console.error('Referral processing error:', referralError);
      return new Response(JSON.stringify({ 
        error: 'Failed to process referral', 
        details: referralError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!result?.success) {
      console.log('Referral processing failed:', result?.error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: result?.error || 'Unknown referral processing error'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Referral processed successfully:', result);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Referral tracked successfully',
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in track-referral function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});