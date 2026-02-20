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

    const body = await req.json();
    const { webhookId, eventType = 'test', payload = { test: true, timestamp: new Date().toISOString() } } = body;

    if (!webhookId) {
      throw new Error('Webhook ID is required');
    }

    console.log(`Testing webhook: ${webhookId}`);

    // Get the webhook
    const { data: webhook, error: webhookError } = await supabaseClient
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .eq('user_id', user.id)
      .single();

    if (webhookError) throw webhookError;
    if (!webhook) throw new Error('Webhook not found');

    // Call the trigger-webhooks function
    const { data: result, error: triggerError } = await supabaseClient.functions.invoke('trigger-webhooks', {
      body: {
        eventType,
        payload: {
          ...payload,
          test_mode: true,
          webhook_test: true
        },
        webhookId: webhook.id
      }
    });

    if (triggerError) {
      console.error('Trigger error:', triggerError);
      throw triggerError;
    }

    console.log(`Webhook test completed:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        result,
        message: 'Webhook test completed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook test error:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});