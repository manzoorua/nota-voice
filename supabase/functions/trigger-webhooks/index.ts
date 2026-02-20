import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHash, createHmac } from "https://deno.land/std@0.192.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookData {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  auth_type: string;
  auth_config: Record<string, any>;
  secret_key?: string;
  retry_count: number;
  timeout_seconds: number;
}

async function callWebhook(webhook: WebhookData, eventType: string, payload: any, attemptNumber = 1): Promise<{success: boolean, response_status?: number, response_body?: string, response_time_ms?: number, error_message?: string}> {
  const startTime = Date.now();
  
  try {
    console.log(`Calling webhook ${webhook.id}, attempt ${attemptNumber}`);
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'NotaVoice-Webhooks/1.0',
      'X-Event-Type': eventType,
      ...webhook.headers
    };

    // Add authentication headers
    if (webhook.auth_type === 'bearer' && webhook.auth_config.token) {
      headers['Authorization'] = `Bearer ${webhook.auth_config.token}`;
    } else if (webhook.auth_type === 'api_key' && webhook.auth_config.key && webhook.auth_config.header) {
      headers[webhook.auth_config.header] = webhook.auth_config.key;
    } else if (webhook.auth_type === 'basic' && webhook.auth_config.username && webhook.auth_config.password) {
      const credentials = btoa(`${webhook.auth_config.username}:${webhook.auth_config.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Add webhook signature if secret key is provided
    if (webhook.secret_key) {
      const payloadString = JSON.stringify(payload);
      const signature = await createHmac('sha256', webhook.secret_key, payloadString);
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Make the webhook call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), webhook.timeout_seconds * 1000);

    const response = await fetch(webhook.url, {
      method: webhook.method,
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    const responseBody = await response.text();

    return {
      success: response.ok,
      response_status: response.status,
      response_body: responseBody.slice(0, 1000), // Limit response body size
      response_time_ms: responseTime
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`Webhook call failed:`, error);
    
    return {
      success: false,
      response_time_ms: responseTime,
      error_message: error.message
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { eventType, payload, userId, webhookId } = await req.json();

    if (!eventType || !payload) {
      throw new Error('Event type and payload are required');
    }

    console.log(`Processing webhook trigger for event: ${eventType}`);

    // Get webhooks to trigger
    let webhooksQuery = supabaseClient
      .from('webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('events', [eventType]);

    // Filter by user if provided
    if (userId) {
      webhooksQuery = webhooksQuery.eq('user_id', userId);
    }

    // Filter by specific webhook if provided
    if (webhookId) {
      webhooksQuery = webhooksQuery.eq('id', webhookId);
    }

    const { data: webhooks, error: webhooksError } = await webhooksQuery;

    if (webhooksError) throw webhooksError;

    if (!webhooks || webhooks.length === 0) {
      console.log(`No active webhooks found for event: ${eventType}`);
      return new Response(
        JSON.stringify({ message: 'No webhooks to trigger', triggered: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${webhooks.length} webhooks to trigger`);

    // Process webhooks in parallel
    const webhookPromises = webhooks.map(async (webhook) => {
      let attempt = 1;
      let success = false;
      let lastResult: any = null;

      // Retry logic
      while (attempt <= webhook.retry_count && !success) {
        const result = await callWebhook(webhook, eventType, payload, attempt);
        lastResult = result;
        success = result.success;

        // Log the attempt
        await supabaseClient
          .from('webhook_logs')
          .insert({
            webhook_id: webhook.id,
            event_type: eventType,
            payload,
            response_status: result.response_status,
            response_body: result.response_body,
            response_time_ms: result.response_time_ms,
            error_message: result.error_message,
            attempt_number: attempt,
            success: result.success
          });

        if (!success && attempt < webhook.retry_count) {
          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        attempt++;
      }

      // Update webhook statistics
      if (success) {
        await supabaseClient
          .from('webhooks')
          .update({
            success_count: webhook.success_count + 1,
            last_triggered_at: new Date().toISOString()
          })
          .eq('id', webhook.id);
      } else {
        await supabaseClient
          .from('webhooks')
          .update({
            failure_count: webhook.failure_count + 1,
            last_triggered_at: new Date().toISOString()
          })
          .eq('id', webhook.id);
      }

      return {
        webhook_id: webhook.id,
        webhook_name: webhook.name,
        success,
        attempts: attempt - 1,
        ...lastResult
      };
    });

    const results = await Promise.all(webhookPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`Webhook processing complete. ${successCount}/${results.length} successful`);

    return new Response(
      JSON.stringify({
        triggered: results.length,
        successful: successCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook trigger error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});