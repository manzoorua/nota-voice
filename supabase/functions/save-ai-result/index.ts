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

    const { 
      content, 
      result_type, 
      original_text, 
      metadata = {}, 
      processing_time_ms,
      labels = []
    } = await req.json();

    if (!content || !result_type || !original_text) {
      throw new Error('Missing required fields: content, result_type, original_text');
    }

    // Save AI result to database
    const { data: aiResult, error: insertError } = await supabaseClient
      .from('ai_results')
      .insert({
        user_id: user.id,
        content,
        result_type,
        original_text,
        metadata,
        processing_time_ms,
        labels
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving AI result:', insertError);
      throw new Error('Failed to save AI result');
    }

    // Update label usage counts if labels were provided
    if (labels.length > 0) {
      for (const label of labels) {
        await supabaseClient
          .from('user_labels')
          .upsert({
            user_id: user.id,
            label_name: label,
            usage_count: 1
          }, {
            onConflict: 'user_id,label_name'
          });

        // Increment usage count for existing labels
        await supabaseClient.rpc('increment_label_usage', {
          p_user_id: user.id,
          p_label_name: label
        });
      }
    }

    console.log('AI result saved successfully:', aiResult.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: aiResult,
        message: 'AI result saved successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in save-ai-result function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});