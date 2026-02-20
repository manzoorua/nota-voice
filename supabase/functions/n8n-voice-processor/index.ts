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

    const { audioData, language = 'en', style = 'clean', title = 'Voice Note' } = await req.json();

    if (!audioData) {
      throw new Error('Audio data is required');
    }

    // Get system configuration to determine processing method
    const { data: config } = await supabaseClient
      .from('system_configuration')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log(`N8N Configuration: enabled=${config?.n8n_enabled}, primary=${config?.n8n_primary_mode}`);

    // Security validations
    const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
    const audioSize = audioBuffer.length;
    const estimatedDuration = audioSize / (16000 / 8);
    
    // Check file size limits
    const maxFileSize = config?.n8n_enabled ? 
      (config.max_file_size_n8n_mb || 100) * 1024 * 1024 : 
      10 * 1024 * 1024;
    
    if (audioSize > maxFileSize) {
      throw new Error(`Audio file too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB.`);
    }

    // Check rate limits
    const { data: limitCheck, error: limitError } = await supabaseClient.rpc('check_voice_processing_limit', {
      _user_id: user.id,
      _duration_seconds: Math.round(estimatedDuration)
    });

    if (limitError || !limitCheck.allowed) {
      throw new Error(`Rate limit exceeded: ${limitCheck?.reason || 'Unknown error'}`);
    }

    // Create initial voice note record
    const { data: note, error: noteError } = await supabaseClient
      .from('voice_notes')
      .insert({
        user_id: user.id,
        title: title,
        status: 'processing',
        language: language,
        processing_method: config?.n8n_enabled ? 'n8n' : 'edge_functions',
        processing_started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (noteError) {
      throw new Error(`Failed to create note: ${noteError.message}`);
    }

    console.log(`Created note ${note.id}, processing method: ${note.processing_method}`);

    // Determine processing route
    if (config?.n8n_enabled && config?.n8n_voice_upload_endpoint) {
      try {
        // Try N8N processing first
        const n8nResponse = await processWithN8N(note, audioData, language, style, config, supabaseClient);
        
        if (n8nResponse.success) {
          console.log(`Successfully initiated N8N processing for note ${note.id}`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              note: { ...note, status: 'processing' },
              processing_method: 'n8n',
              message: 'Processing started with N8N workflow'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (config.n8n_fallback_enabled) {
          // Fallback to edge functions
          console.log(`N8N processing failed, falling back to edge functions for note ${note.id}`);
          await updateNoteProcessingMethod(note.id, 'hybrid', 'N8N unavailable, using fallback', supabaseClient);
          return await processWithEdgeFunctions(note, audioData, language, style, supabaseClient);
        } else {
          throw new Error('N8N processing failed and fallback is disabled');
        }
      } catch (error) {
        if (config.n8n_fallback_enabled) {
          console.log(`N8N error, falling back to edge functions: ${error.message}`);
          await updateNoteProcessingMethod(note.id, 'hybrid', `N8N error: ${error.message}`, supabaseClient);
          return await processWithEdgeFunctions(note, audioData, language, style, supabaseClient);
        } else {
          throw error;
        }
      }
    } else {
      // Use edge functions directly
      console.log(`Processing with edge functions for note ${note.id}`);
      return await processWithEdgeFunctions(note, audioData, language, style, supabaseClient);
    }

  } catch (error) {
    console.error('Voice processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function processWithN8N(note: any, audioData: string, language: string, style: string, config: any, supabaseClient: any) {
  const n8nPayload = {
    noteId: note.id,
    audioData: audioData,
    language: language,
    style: style,
    metadata: {
      userId: note.user_id,
      timestamp: new Date().toISOString(),
      supabaseUrl: Deno.env.get('SUPABASE_URL'),
      callbackToken: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    }
  };

  // Add webhook signature if secret is configured
  let headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (config.n8n_webhook_secret) {
    const signature = await generateWebhookSignature(JSON.stringify(n8nPayload), config.n8n_webhook_secret);
    headers['X-N8N-Signature'] = signature;
  }

  const response = await fetch(config.n8n_voice_upload_endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(n8nPayload),
    signal: AbortSignal.timeout((config.processing_timeout_seconds || 300) * 1000)
  });

  if (!response.ok) {
    throw new Error(`N8N endpoint returned ${response.status}: ${await response.text()}`);
  }

  // Update processing steps
  await supabaseClient
    .from('voice_notes')
    .update({
      processing_steps: { n8n_initiated: new Date().toISOString() },
      n8n_workflow_id: `n8n_${note.id}`
    })
    .eq('id', note.id);

  return { success: true };
}

async function processWithEdgeFunctions(note: any, audioData: string, language: string, style: string, supabaseClient: any) {
  console.log(`Starting edge function processing for note ${note.id}`);

  // Start transcription process
  const transcribeResponse = await supabaseClient.functions.invoke('transcribe-audio', {
    body: {
      noteId: note.id,
      audioData: audioData,
      language: language
    }
  });

  if (transcribeResponse.error) {
    throw new Error(`Transcription failed: ${transcribeResponse.error.message}`);
  }

  console.log(`Transcription completed for note ${note.id}`);

  // Enhance the transcription
  const enhanceResponse = await supabaseClient.functions.invoke('enhance-text', {
    body: {
      noteId: note.id,
      rawTranscript: transcribeResponse.data.transcript,
      style: style
    }
  });

  if (enhanceResponse.error) {
    console.error(`Enhancement failed: ${enhanceResponse.error.message}`);
    // Still save the raw transcript
    await supabaseClient
      .from('voice_notes')
      .update({
        content: transcribeResponse.data.transcript,
        status: 'completed',
        processing_steps: { transcription_completed: new Date().toISOString() }
      })
      .eq('id', note.id);
  }

  // Get the final note
  const { data: finalNote } = await supabaseClient
    .from('voice_notes')
    .select('*')
    .eq('id', note.id)
    .single();

  return new Response(
    JSON.stringify({ 
      success: true, 
      note: finalNote,
      processing_method: 'edge_functions'
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function updateNoteProcessingMethod(noteId: string, method: string, reason: string, supabaseClient: any) {
  await supabaseClient
    .from('voice_notes')
    .update({
      processing_method: method,
      fallback_reason: reason,
      processing_steps: { fallback_triggered: new Date().toISOString() }
    })
    .eq('id', noteId);
}

async function generateWebhookSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}