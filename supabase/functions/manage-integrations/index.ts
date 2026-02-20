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

    if (method === 'GET') {
      // Get integrations for the user
      const { data: integrations, error } = await supabaseClient
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ integrations }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'POST') {
      const body = await req.json();
      const { integration_type, name, description, config = {}, webhook_url, credentials = {} } = body;

      if (!integration_type || !name) {
        throw new Error('Integration type and name are required');
      }

      // Create new integration
      const { data: integration, error } = await supabaseClient
        .from('integrations')
        .insert({
          user_id: user.id,
          integration_type,
          name,
          description,
          config,
          webhook_url,
          credentials,
          sync_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`Created integration: ${integration.id} for user: ${user.id}`);

      return new Response(
        JSON.stringify({ integration }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'PUT') {
      const body = await req.json();
      const { id, ...updateData } = body;

      if (!id) {
        throw new Error('Integration ID is required');
      }

      // Update integration
      const { data: integration, error } = await supabaseClient
        .from('integrations')
        .update({
          ...updateData,
          last_sync_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      console.log(`Updated integration: ${integration.id}`);

      return new Response(
        JSON.stringify({ integration }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'DELETE') {
      const id = url.searchParams.get('id');

      if (!id) {
        throw new Error('Integration ID is required');
      }

      // Delete integration
      const { error } = await supabaseClient
        .from('integrations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log(`Deleted integration: ${id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('Integration management error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});