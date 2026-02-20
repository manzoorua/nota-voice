import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    console.log(`Checking subscription for user ${user.id}`);

    // Check user's subscription in profiles table
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('subscription_status, subscription_tier, subscription_end')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    // Default subscription data
    let subscriptionData = {
      subscribed: false,
      subscription_tier: null,
      subscription_end: null
    };

    if (profile) {
      const now = new Date();
      const subscriptionEnd = profile.subscription_end ? new Date(profile.subscription_end) : null;
      
      subscriptionData = {
        subscribed: profile.subscription_status === 'active' && (!subscriptionEnd || subscriptionEnd > now),
        subscription_tier: profile.subscription_tier,
        subscription_end: profile.subscription_end
      };
    }

    console.log(`Subscription check result:`, subscriptionData);

    return new Response(
      JSON.stringify(subscriptionData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Subscription check error:', error);

    return new Response(
      JSON.stringify({ 
        error: error.message,
        subscribed: false,
        subscription_tier: null,
        subscription_end: null
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});