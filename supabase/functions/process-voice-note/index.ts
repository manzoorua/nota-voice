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

    // Route to N8N voice processor for intelligent routing
    const processorResponse = await supabaseClient.functions.invoke('n8n-voice-processor', {
      body: {
        audioData,
        language,
        style,
        title
      }
    });

    if (processorResponse.error) {
      throw new Error(`Voice processing failed: ${processorResponse.error.message}`);
    }

    return new Response(
      JSON.stringify(processorResponse.data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // Security validations
    const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
    const audioSize = audioBuffer.length;
    
    // Check file size (10MB limit)
    const maxFileSize = 10 * 1024 * 1024;
    if (audioSize > maxFileSize) {
      throw new Error('Audio file too large. Maximum size is 10MB.');
    }

    // Estimate duration (rough calculation: ~16kbps for webm)
    const estimatedDuration = audioSize / (16000 / 8); // bytes per second
    
    console.log(`Processing audio: ${audioSize} bytes, estimated ${Math.round(estimatedDuration)}s duration`);

    // Check rate limits
    const { data: limitCheck, error: limitError } = await supabaseClient.rpc('check_voice_processing_limit', {
      _user_id: user.id,
      _duration_seconds: Math.round(estimatedDuration)
    });

    if (limitError) {
      console.error('Rate limit check failed:', limitError);
      throw new Error('Unable to verify processing limits');
    }

    if (!limitCheck.allowed) {
      throw new Error(`Rate limit exceeded: ${limitCheck.reason}. Try again tomorrow.`);
    }

    console.log(`Starting voice note processing for user ${user.id}, remaining: ${limitCheck.remaining_count} notes, ${limitCheck.remaining_duration}s`);

    // Create initial voice note record
    const { data: note, error: noteError } = await supabaseClient
      .from('voice_notes')
      .insert({
        user_id: user.id,
        title: title,
        status: 'processing',
        language: language
      })
      .select()
      .single();

    if (noteError) {
      throw new Error(`Failed to create note: ${noteError.message}`);
    }

    console.log(`Created note ${note.id}, starting transcription`);

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
          status: 'completed'
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
        note: finalNote
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Voice note processing error:', error);

    // Log processing failure for security monitoring
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        const { data: { user } } = await supabaseClient.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        
        if (user) {
          await supabaseClient.rpc('log_voice_note_processing', {
            _user_id: user.id,
            _file_size: 0,
            _duration_seconds: 0,
            _processing_time_ms: null,
            _error_message: error.message
          });
        }
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});