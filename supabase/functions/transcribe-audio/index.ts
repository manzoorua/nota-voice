import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging utility
const log = (requestId: string, step: string, status: 'SUCCESS' | 'FAILED', data?: any, error?: string, startTime?: number) => {
  const logEntry = {
    requestId,
    step,
    timestamp: Date.now(),
    duration: startTime ? Date.now() - startTime : undefined,
    success: status === 'SUCCESS',
    error,
    metadata: data
  };
  
  const logLevel = status === 'FAILED' ? 'error' : 'log';
  console[logLevel](`[${requestId}] ${step}: ${status} ${logEntry.duration ? `(${logEntry.duration}ms)` : ''}`, logEntry);
};

serve(async (req) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const requestStartTime = Date.now();

  console.log(`[${requestId}] === NEW TRANSCRIPTION REQUEST STARTED ===`);
  console.log(`[${requestId}] Method: ${req.method}, URL: ${req.url}`);
  console.log(`[${requestId}] Headers:`, Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    log(requestId, 'CORS Preflight', 'SUCCESS', { method: req.method });
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Environment validation
    const envStartTime = Date.now();
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    log(requestId, 'Environment Validation', 'SUCCESS', {
      hasOpenAIKey: !!openAIKey,
      keyLength: openAIKey?.length,
      denoVersion: Deno.version.deno,
      environment: 'edge-function'
    }, undefined, envStartTime);

    if (!openAIKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseKey ?? '',
      { auth: { persistSession: false } }
    );

    // Parse request body first to check for demo mode
    const bodyStartTime = Date.now();
    
    // SURGICAL FIX: Enhanced request body parsing with detailed logging
    console.log(`[${requestId}] === RAW REQUEST BODY DEBUG ===`);
    const rawBodyText = await req.text();
    console.log(`[${requestId}] Raw body length:`, rawBodyText.length);
    console.log(`[${requestId}] Raw body first 500 chars:`, rawBodyText.substring(0, 500));
    console.log(`[${requestId}] Raw body last 100 chars:`, rawBodyText.substring(rawBodyText.length - 100));
    
    let requestBody: any;
    try {
      requestBody = JSON.parse(rawBodyText);
      console.log(`[${requestId}] Parsed JSON successfully`);
      console.log(`[${requestId}] Request body keys:`, Object.keys(requestBody));
      console.log(`[${requestId}] audioData exists:`, !!requestBody.audioData);
      console.log(`[${requestId}] audioData type:`, typeof requestBody.audioData);
      console.log(`[${requestId}] audioData length:`, requestBody.audioData?.length);
    } catch (parseError: any) {
      console.error(`[${requestId}] JSON parse error:`, parseError.message);
      throw new Error(`Failed to parse request body: ${parseError.message}`);
    }
    
    const { noteId, audioData, storagePath, language = 'en', mimeType = 'audio/webm', uploadSource = 'recording', demoMode = false } = requestBody;

    // Authentication (optional for demo mode)
    const authStartTime = Date.now();
    const authHeader = req.headers.get('Authorization');
    let user = null;
    
    if (authHeader) {
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      
      if (!authError && authUser) {
        user = authUser;
        log(requestId, 'Authentication Check', 'SUCCESS', { userId: user.id }, undefined, authStartTime);
      } else {
        log(requestId, 'Authentication Check', 'FAILED', { authError }, authError?.message || 'User not found');
      }
    }
    
    // For demo mode, we don't require authentication
    if (!user && !demoMode) {
      log(requestId, 'Authentication Required', 'FAILED', undefined, 'User not authenticated and not in demo mode');
      throw new Error('Unauthorized');
    }
    
    if (demoMode && !user) {
      log(requestId, 'Demo Mode', 'SUCCESS', { mode: 'demo' }, undefined, authStartTime);
    }

    // Check and enforce 4-note limit before processing (only if creating a new note and user is authenticated)
    if (noteId && user) {
      const limitCheckStartTime = Date.now();
      const { data: limitResult, error: limitError } = await supabaseClient.rpc(
        'check_and_enforce_note_limit',
        { _user_id: user.id }
      );

      if (limitError) {
        log(requestId, 'Note Limit Check', 'FAILED', undefined, `Failed to check note limit: ${limitError.message}`);
        throw new Error(`Failed to check note limit: ${limitError.message}`);
      }

      log(requestId, 'Note Limit Check', 'SUCCESS', limitResult, undefined, limitCheckStartTime);

      if (limitResult.note_deleted) {
        log(requestId, 'Note Limit Enforcement', 'SUCCESS', {
          deletedNoteId: limitResult.deleted_note_id,
          deletedNoteTitle: limitResult.deleted_note_title,
          currentCount: limitResult.current_count
        }, `Oldest note deleted to maintain 4-note limit`);
      }
    }

    log(requestId, 'Request Body Parsing', 'SUCCESS', {
      hasAudio: !!audioData,
      hasStoragePath: !!storagePath,
      hasNoteId: !!noteId,
      uploadSource,
      bodyKeys: Object.keys(requestBody)
    }, undefined, bodyStartTime);

    // Validate audio input (either direct data or storage path)
    if (!audioData && !storagePath) {
      log(requestId, 'Audio Input Check', 'FAILED', {
        requestBody: Object.keys(requestBody)
      }, 'No audio data or storage path provided');
      throw new Error('No audio data or storage path provided');
    }

    let binaryAudio: Uint8Array;

    if (storagePath) {
      // Handle uploaded file from storage
      const storageStartTime = Date.now();
      try {
        const { data: fileData, error: downloadError } = await supabaseClient.storage
          .from('audio-uploads')
          .download(storagePath);

        if (downloadError) {
          log(requestId, 'Storage Download', 'FAILED', { storagePath }, downloadError.message);
          throw new Error(`Failed to download file: ${downloadError.message}`);
        }

        // Convert to binary without loading entire file into memory as base64
        const fileBuffer = await fileData.arrayBuffer();
        binaryAudio = new Uint8Array(fileBuffer);

        log(requestId, 'Storage Download', 'SUCCESS', {
          storagePath,
          fileSizeKB: Math.round(binaryAudio.length / 1024),
          mimeType
        }, undefined, storageStartTime);

      } catch (storageError: any) {
        log(requestId, 'Storage Processing', 'FAILED', { storagePath }, storageError.message);
        throw new Error(`Storage processing failed: ${storageError.message}`);
      }
    } else {
      // Handle direct audio data (existing recording logic)
      if (typeof audioData !== 'string') {
        log(requestId, 'Audio Data Validation', 'FAILED', {
          audioDataType: typeof audioData
        }, 'Audio data must be a string');
        throw new Error('Audio data must be a string');
      }

      if (audioData.length < 100) {
        log(requestId, 'Audio Data Validation', 'FAILED', {
          audioDataLength: audioData.length
        }, 'Audio data too short (minimum 100 characters)');
        throw new Error('Audio data too short (minimum 100 characters)');
      }

      // Check for valid base64 format
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(audioData)) {
        log(requestId, 'Audio Data Validation', 'FAILED', {
          audioDataLength: audioData.length,
          firstChars: audioData.substring(0, 50)
        }, 'Invalid base64 format detected');
        throw new Error('Invalid base64 format detected');
      }

      // Convert base64 to binary
      const conversionStartTime = Date.now();
      try {
        binaryAudio = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
        
        log(requestId, 'Base64 Conversion', 'SUCCESS', {
          originalLength: audioData.length,
          binaryLength: binaryAudio.length,
          sizeKB: Math.round(binaryAudio.length / 1024)
        }, undefined, conversionStartTime);
      } catch (conversionError: any) {
        log(requestId, 'Base64 Conversion', 'FAILED', {
          audioDataLength: audioData.length
        }, `Base64 conversion failed: ${conversionError.message}`);
        throw new Error(`Invalid base64 audio data: ${conversionError.message}`);
      }
    }

    log(requestId, 'Audio Processing', 'SUCCESS', {
      audioSizeKB: Math.round(binaryAudio.length / 1024),
      processingMethod: storagePath ? 'storage' : 'base64',
      mimeType,
      language
    });

    // Update note status to transcribing
    if (noteId) {
      const updateStartTime = Date.now();
      const { error: updateError } = await supabaseClient
        .from('voice_notes')
        .update({ status: 'transcribing' })
        .eq('id', noteId);
      
      if (updateError) {
        log(requestId, 'Note Status Update', 'FAILED', { noteId }, `Failed to update note status: ${updateError.message}`);
        throw new Error(`Failed to update note status: ${updateError.message}`);
      }
      
      log(requestId, 'Note Status Update', 'SUCCESS', { noteId }, undefined, updateStartTime);
    }

    // Validate converted audio size (OpenAI Whisper API limit is 25MB)
    const minSize = 1024; // 1KB
    const maxSize = 25 * 1024 * 1024; // 25MB (OpenAI limit)
    
    if (binaryAudio.length < minSize) {
      log(requestId, 'Audio Size Validation', 'FAILED', {
        actualSize: binaryAudio.length,
        minSize
      }, `Audio file too small: ${binaryAudio.length} bytes`);
      throw new Error(`Audio file too small: ${binaryAudio.length} bytes (minimum: ${minSize} bytes)`);
    }
    
    if (binaryAudio.length > maxSize) {
      log(requestId, 'Audio Size Validation', 'FAILED', {
        actualSize: binaryAudio.length,
        maxSize,
        sizeMB: Math.round(binaryAudio.length / 1024 / 1024)
      }, `Audio file exceeds OpenAI limit: ${Math.round(binaryAudio.length / 1024 / 1024)}MB`);
      throw new Error(`Audio file too large: ${Math.round(binaryAudio.length / 1024 / 1024)}MB. OpenAI Whisper API has a 25MB limit. Please use a shorter recording or compress your audio file.`);
    }

    log(requestId, 'Audio Size Validation', 'SUCCESS', {
      audioSize: binaryAudio.length,
      audioSizeKB: Math.round(binaryAudio.length / 1024),
      audioSizeMB: Math.round(binaryAudio.length / 1024 / 1024)
    });

    // Create form data for OpenAI with enhanced validation
    const formDataStartTime = Date.now();
    const audioBlob = new Blob([binaryAudio], { type: mimeType });
    
    // Determine file extension
    const ext = mimeType.includes('webm') ? 'webm' : 
                mimeType.includes('mp4') ? 'mp4' : 
                mimeType.includes('m4a') || mimeType.includes('aac') ? 'm4a' : 
                mimeType.includes('mpeg') ? 'mp3' : 
                mimeType.includes('ogg') ? 'ogg' : 
                mimeType.includes('wav') ? 'wav' : 'webm';
    
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', language);

    log(requestId, 'Form Data Preparation', 'SUCCESS', {
      blobSize: audioBlob.size,
      blobType: audioBlob.type,
      fileExtension: ext,
      language,
      model: 'whisper-1'
    }, undefined, formDataStartTime);

    // Call OpenAI Whisper API with enhanced error handling and retries
    const openAIStartTime = Date.now();
    let response: Response;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount <= maxRetries) {
      try {
        log(requestId, 'OpenAI API Call', retryCount === 0 ? 'SUCCESS' : 'SUCCESS', {
          attempt: retryCount + 1,
          maxRetries: maxRetries + 1,
          endpoint: 'https://api.openai.com/v1/audio/transcriptions'
        });

        response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIKey}`,
          },
          body: formData,
        });

        if (response.ok) {
          break;
        } else {
          const errorText = await response.text();
          log(requestId, 'OpenAI API Response', 'FAILED', {
            status: response.status,
            statusText: response.statusText,
            attempt: retryCount + 1
          }, `HTTP ${response.status}: ${errorText}`);

          if (retryCount === maxRetries) {
            throw new Error(`OpenAI API error after ${maxRetries + 1} attempts: HTTP ${response.status} - ${errorText}`);
          }
          
          retryCount++;
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      } catch (fetchError: any) {
        log(requestId, 'OpenAI API Request', 'FAILED', {
          attempt: retryCount + 1,
          errorType: fetchError.constructor.name
        }, `Network error: ${fetchError.message}`);

        if (retryCount === maxRetries) {
          throw new Error(`Network error after ${maxRetries + 1} attempts: ${fetchError.message}`);
        }
        
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    // Parse OpenAI response
    const responseParseStartTime = Date.now();
    let result: any;
    
    try {
      result = await response.json();
      
      log(requestId, 'OpenAI Response Parsing', 'SUCCESS', {
        hasText: !!result.text,
        textLength: result.text?.length,
        responseKeys: Object.keys(result)
      }, undefined, responseParseStartTime);
    } catch (parseError: any) {
      log(requestId, 'OpenAI Response Parsing', 'FAILED', undefined, `Failed to parse OpenAI response: ${parseError.message}`);
      throw new Error(`Failed to parse OpenAI response: ${parseError.message}`);
    }

    if (!result.text) {
      log(requestId, 'Transcription Result Validation', 'FAILED', { result }, 'No transcription text in OpenAI response');
      throw new Error('No transcription text returned from OpenAI');
    }

    const processingTime = Date.now() - openAIStartTime;
    
    log(requestId, 'Transcription Completed', 'SUCCESS', {
      transcriptionLength: result.text.length,
      processingTimeMs: processingTime,
      totalRetries: retryCount
    });

    // Update note with transcription and mark as completed
    if (noteId) {
      const dbUpdateStartTime = Date.now();
      const { error: updateError } = await supabaseClient
        .from('voice_notes')
        .update({
          transcription: result.text,
          content: result.text, // Set content for uploaded files
          status: 'completed',
          processing_metadata: { 
            transcription_time_ms: processingTime,
            request_id: requestId,
            retries: retryCount,
            note_limit_enforced: true,
            processed_at: new Date().toISOString(),
            upload_source: uploadSource
          }
        })
        .eq('id', noteId);

      if (updateError) {
        log(requestId, 'Database Update', 'FAILED', { noteId }, `Failed to update note: ${updateError.message}`);
        throw new Error(`Failed to update note: ${updateError.message}`);
      }

      log(requestId, 'Database Update', 'SUCCESS', { noteId }, undefined, dbUpdateStartTime);
    }

    const totalDuration = Date.now() - requestStartTime;
    log(requestId, 'Request Completed', 'SUCCESS', {
      totalDurationMs: totalDuration,
      transcriptionLength: result.text.length
    });

    console.log(`[${requestId}] === REQUEST COMPLETED SUCCESSFULLY ===`);

    return new Response(
      JSON.stringify({ 
        transcript: result.text,
        processingTime,
        requestId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const totalDuration = Date.now() - requestStartTime;
    
    log(requestId, 'Request Failed', 'FAILED', {
      errorType: error.constructor.name,
      errorStack: error.stack,
      totalDurationMs: totalDuration
    }, error.message);

    console.log(`[${requestId}] === REQUEST ENDED WITH ERROR ===`);
    console.error(`[${requestId}] Error stack:`, error.stack);
    console.error(`[${requestId}] Transcription error (${totalDuration}ms):`, error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        requestId,
        duration: totalDuration
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});