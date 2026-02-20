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

    const url = new URL(req.url);
    const method = req.method;

    // Handle different HTTP methods
    if (method === 'GET') {
      // Get all webhooks for the user
      const { data: webhooks, error } = await supabaseClient
        .from('webhooks')
        .select(`
          *,
          webhook_logs!webhook_logs_webhook_id_fkey (
            id,
            event_type,
            success,
            created_at,
            response_status,
            error_message
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ webhooks }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'POST') {
      const body = await req.json();
      const { name, description, url: webhookUrl, method: webhookMethod = 'POST', headers: webhookHeaders = {}, auth_type = 'none', auth_config = {}, events = [], retry_count = 3, timeout_seconds = 30, secret_key } = body;

      if (!name || !webhookUrl) {
        throw new Error('Name and URL are required');
      }

      // Create new webhook
      const { data: webhook, error } = await supabaseClient
        .from('webhooks')
        .insert({
          user_id: user.id,
          name,
          description,
          url: webhookUrl,
          method: webhookMethod,
          headers: webhookHeaders,
          auth_type,
          auth_config,
          events,
          retry_count,
          timeout_seconds,
          secret_key
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`Created webhook: ${webhook.id} for user: ${user.id}`);

      return new Response(
        JSON.stringify({ webhook }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'PUT') {
      const body = await req.json();
      const { id, ...updateData } = body;

      if (!id) {
        throw new Error('Webhook ID is required');
      }

      // Update webhook
      const { data: webhook, error } = await supabaseClient
        .from('webhooks')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      console.log(`Updated webhook: ${webhook.id}`);

      return new Response(
        JSON.stringify({ webhook }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'DELETE') {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');

      if (!id) {
        throw new Error('Webhook ID is required');
      }

      // Delete webhook
      const { error } = await supabaseClient
        .from('webhooks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log(`Deleted webhook: ${id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('Webhook management error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});