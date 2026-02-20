import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-n8n-signature',
};

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

    const body = await req.text();
    let webhookData;
    
    try {
      webhookData = JSON.parse(body);
    } catch {
      throw new Error('Invalid JSON payload');
    }

    const { noteId, status, transcript, enhancedContent, error, processingTimeMs, workflowId } = webhookData;

    if (!noteId) {
      throw new Error('Note ID is required');
    }

    console.log(`Processing N8N webhook for note ${noteId}, status: ${status}`);

    // Verify webhook signature if configured
    const signature = req.headers.get('x-n8n-signature');
    if (signature) {
      const { data: config } = await supabaseClient
        .from('system_configuration')
        .select('n8n_webhook_secret')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (config?.n8n_webhook_secret) {
        const isValid = await verifyWebhookSignature(body, signature, config.n8n_webhook_secret);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }
    }

    // Get current note
    const { data: currentNote, error: noteError } = await supabaseClient
      .from('voice_notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (noteError || !currentNote) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Update note based on status
    const updateData: any = {
      processing_steps: {
        ...currentNote.processing_steps,
        [`n8n_${status}`]: new Date().toISOString()
      }
    };

    if (workflowId) {
      updateData.n8n_workflow_id = workflowId;
    }

    switch (status) {
      case 'transcription_completed':
        updateData.transcription = transcript;
        updateData.processing_steps.transcription_completed = new Date().toISOString();
        break;

      case 'enhancement_completed':
        updateData.content = enhancedContent || transcript;
        updateData.processing_steps.enhancement_completed = new Date().toISOString();
        break;

      case 'completed':
        updateData.status = 'completed';
        updateData.transcription = transcript;
        updateData.content = enhancedContent || transcript;
        updateData.processing_steps.completed = new Date().toISOString();
        
        // Log successful processing
        await supabaseClient.rpc('log_voice_note_processing', {
          _user_id: currentNote.user_id,
          _file_size: 0, // We don't have file size in webhook
          _duration_seconds: 0, // We don't have duration in webhook
          _processing_time_ms: processingTimeMs,
          _error_message: null,
          _processing_method: 'n8n'
        });
        break;

      case 'failed':
      case 'error':
        updateData.status = 'failed';
        updateData.processing_error = error || 'N8N workflow failed';
        updateData.processing_steps.failed = new Date().toISOString();
        
        // Log failed processing
        await supabaseClient.rpc('log_voice_note_processing', {
          _user_id: currentNote.user_id,
          _file_size: 0,
          _duration_seconds: 0,
          _processing_time_ms: processingTimeMs,
          _error_message: error || 'N8N workflow failed',
          _processing_method: 'n8n'
        });
        break;

      default:
        // For other statuses (like 'processing', 'transcribing'), just update the steps
        updateData.processing_steps[`n8n_${status}`] = new Date().toISOString();
    }

    // Update the note
    const { error: updateError } = await supabaseClient
      .from('voice_notes')
      .update(updateData)
      .eq('id', noteId);

    if (updateError) {
      throw new Error(`Failed to update note: ${updateError.message}`);
    }

    console.log(`Successfully processed N8N webhook for note ${noteId}`);

    // Log webhook processing for monitoring
    await supabaseClient
      .from('security_audit_logs')
      .insert({
        event_category: 'n8n_webhook',
        event_source: 'n8n_webhook_handler',
        details: {
          note_id: noteId,
          status: status,
          workflow_id: workflowId,
          processing_time_ms: processingTimeMs,
          has_transcript: !!transcript,
          has_enhanced_content: !!enhancedContent,
          timestamp: new Date().toISOString()
        },
        risk_score: error ? 40 : 10
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Note ${noteId} updated with status: ${status}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('N8N webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const expectedSignature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return signature === expectedHex;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}