import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Square } from "lucide-react";
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";
import { useNoteLimit } from "@/hooks/useNoteLimit";
import { Badge } from "@/components/ui/badge";
import { VoiceRecorderHelp } from "@/components/ui/VoiceRecorderHelp";
import { formatTime, getSupportedMimeType, getExtFromMime, isIframe, isIOS, preflightChecks } from "@/utils/voiceRecorderUtils";

interface VoiceRecorderProps {
  onTranscription?: (text: string, appendMode?: boolean) => void;
  selectedNote?: VoiceNote | null;
  showHomePageHelp?: boolean;
}

interface VoiceNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

const VoiceRecorder = ({
  onTranscription,
  selectedNote,
  showHomePageHelp = false
}: VoiceRecorderProps) => {
  console.log("VoiceRecorder: React is", React);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [recordingData, setRecordingData] = React.useState<Blob | null>(null);
  const [detectedMimeType, setDetectedMimeType] = React.useState<string>("");
  const [fileExt, setFileExt] = React.useState<string>("webm");
  const [manualNewNoteMode, setManualNewNoteMode] = React.useState(false);
  const effectiveAppendMode = selectedNote && !manualNewNoteMode;
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Note limit tracking
  const { currentCount, limit, remaining, canCreateNote, loading: limitLoading } = useNoteLimit();

  // Reset manual mode when selected note changes
  React.useEffect(() => {
    setManualNewNoteMode(false);
  }, [selectedNote]);

  // Environment diagnostics
  const isIframeEnv = isIframe();
  const isIOSDevice = isIOS();


  const startRecording = async () => {
    try {
      // Check note limit before starting recording
      if (!canCreateNote && !limitLoading) {
        toast.error(`You've reached the maximum of ${limit} voice notes. Your oldest note will be automatically replaced.`);
      }
      
      // iOS Safari in iframes blocks mic access
      if (isIOSDevice && isIframeEnv) {
        toast.error('iOS Safari blocks microphone in embedded previews. Open this page in a new tab.');
        return;
      }

      // Attempt getUserMedia immediately on user gesture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });


      const mime = getSupportedMimeType();
      setDetectedMimeType(mime);
      setFileExt(getExtFromMime(mime));

      const options = mime ? { mimeType: mime } as MediaRecorderOptions : undefined;
      const mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        setRecordingData(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      if (timerRef.current) clearInterval(timerRef.current as any);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      toast.success('Recording started');
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      const name = error?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        if (isIframeEnv) {
          toast.error('Mic blocked in embedded view. Open in a new tab.');
        } else if (isIOSDevice) {
          toast.error('Mic permission denied. On iOS: Settings > Safari > Microphone.');
        } else {
          toast.error('Microphone access denied.');
        }
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        toast.error('No microphone found.');
      } else {
        toast.error('Failed to start recording. Please check permissions.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // Process transcription when recording data is available
  React.useEffect(() => {
    if (recordingData && !isRecording) {
      processTranscription();
    }
  }, [recordingData, isRecording]);

  const processTranscription = async () => {
    if (!recordingData) {
      console.error('No recording data available');
      return;
    }
    
    setIsProcessing(true);
    
    // Import debugging utilities
    const { AudioDebugger, DebugFileReader, DebugNetworkRequest } = await import('@/utils/audioDebugUtils');
    const audioDebugger = AudioDebugger.getInstance();
    const sessionId = audioDebugger.startSession();
    
    audioDebugger.log('process_transcription_start', 'info', {
      recordingDataSize: recordingData.size,
      recordingDataType: recordingData.type,
      recordingTime,
      appendMode: effectiveAppendMode
    });

    try {
      // Enhanced audio validation
      const validation = audioDebugger.validateAudioBlob(recordingData, recordingTime);
      audioDebugger.log('audio_validation', validation.isValid ? 'success' : 'error', validation);

      if (!validation.isValid) {
        throw new Error(`Audio validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        audioDebugger.log('audio_validation_warnings', 'warning', { warnings: validation.warnings });
      }

      // CRITICAL FIX: Enhanced base64 conversion with proper validation
      audioDebugger.log('base64_conversion_start', 'info', {
        blobSize: recordingData.size,
        blobType: recordingData.type
      });

      let base64Data: string;
      try {
        const debugFileReader = new DebugFileReader(sessionId);
        base64Data = await debugFileReader.readAsBase64(recordingData);
        
        // CRITICAL: Validate base64 data exists and has content
        if (!base64Data || base64Data.length === 0) {
          throw new Error('Base64 conversion resulted in empty data');
        }

        // Additional validation for minimum size
        if (base64Data.length < 100) {
          throw new Error(`Base64 data too short: ${base64Data.length} characters`);
        }

        audioDebugger.log('base64_conversion_success', 'success', {
          base64Length: base64Data.length,
          firstChars: base64Data.substring(0, 50),
          lastChars: base64Data.substring(base64Data.length - 20)
        });
      } catch (conversionError: any) {
        audioDebugger.log('base64_conversion_failed', 'error', {
          errorMessage: conversionError.message,
          blobSize: recordingData.size,
          blobType: recordingData.type
        });
        throw new Error(`Audio conversion failed: ${conversionError.message}`);
      }

      // Check authentication for note saving (optional for demo mode)
      audioDebugger.log('auth_check_start', 'info');
      const { data: user } = await supabase.auth.getUser();
      const isAuthenticated = user?.user;
      audioDebugger.log(isAuthenticated ? 'auth_check_success' : 'auth_check_demo_mode', 
        isAuthenticated ? 'success' : 'info', 
        isAuthenticated ? { userId: user.user.id } : { mode: 'demo' });

      let note = null;
      let transcribeResponse;

      if (effectiveAppendMode && isAuthenticated) {
        // Append mode: Skip note creation, transcribe directly (requires auth)
        audioDebugger.log('append_mode_transcription', 'info', { selectedNoteId: selectedNote?.id });
        
        // CRITICAL: Validate payload before sending
        const payload = {
          audioData: base64Data,
          language: 'en',
          mimeType: detectedMimeType || recordingData.type || 'audio/webm'
        };

        // SURGICAL FIX: Comprehensive payload debugging
        console.log('=== PAYLOAD DEBUG START ===');
        console.log('Payload keys:', Object.keys(payload));
        console.log('audioData exists:', !!payload.audioData);
        console.log('audioData type:', typeof payload.audioData);
        console.log('audioData length:', payload.audioData?.length);
        console.log('audioData first 100 chars:', payload.audioData?.substring(0, 100));
        console.log('Full payload structure:', JSON.stringify({
          ...payload,
          audioData: payload.audioData ? `[${payload.audioData.length} chars]` : null
        }));

        audioDebugger.log('network_payload_validation', 'info', {
          payloadKeys: Object.keys(payload),
          audioDataLength: payload.audioData?.length,
          hasAudioData: !!payload.audioData,
          audioDataType: typeof payload.audioData,
          payloadSize: JSON.stringify(payload).length
        });

        if (!payload.audioData) {
          throw new Error('No audio data in payload for transcription');
        }

        // SURGICAL FIX: Direct supabase.functions.invoke with detailed logging
        console.log('=== DIRECT SUPABASE INVOKE START ===');
        try {
          transcribeResponse = await supabase.functions.invoke('transcribe-audio', {
            body: payload
          });
          console.log('=== SUPABASE INVOKE RESPONSE ===');
          console.log('Response:', transcribeResponse);
        } catch (invokeError: any) {
          console.error('=== SUPABASE INVOKE ERROR ===');
          console.error('Error:', invokeError);
          throw invokeError;
        }
      } else if (isAuthenticated) {
        // New note mode for authenticated users: Create note then transcribe
        audioDebugger.log('note_creation_start', 'info');
        const { data: noteData, error: noteError } = await supabase.from('voice_notes').insert({
          user_id: user.user.id,
          title: `Voice Note ${new Date().toLocaleString()}`,
          status: 'processing',
          language: 'en'
        }).select().single();
        
        if (noteError) {
          audioDebugger.log('note_creation_failed', 'error', noteError, `Failed to create note: ${noteError.message}`);
          throw new Error(`Failed to create note: ${noteError.message}`);
        }
        note = noteData;
        audioDebugger.log('note_creation_success', 'success', { noteId: note.id });

        // CRITICAL: Validate payload before sending
        const payload = {
          noteId: note.id,
          audioData: base64Data,
          language: 'en',
          mimeType: detectedMimeType || recordingData.type || 'audio/webm'
        };

        // SURGICAL FIX: Comprehensive payload debugging
        console.log('=== PAYLOAD DEBUG START (NEW NOTE) ===');
        console.log('Payload keys:', Object.keys(payload));
        console.log('noteId:', payload.noteId);
        console.log('audioData exists:', !!payload.audioData);
        console.log('audioData type:', typeof payload.audioData);
        console.log('audioData length:', payload.audioData?.length);
        console.log('audioData first 100 chars:', payload.audioData?.substring(0, 100));

        audioDebugger.log('network_payload_validation', 'info', {
          payloadKeys: Object.keys(payload),
          audioDataLength: payload.audioData?.length,
          hasAudioData: !!payload.audioData,
          noteId: payload.noteId,
          audioDataType: typeof payload.audioData,
          payloadSize: JSON.stringify(payload).length
        });

        if (!payload.audioData) {
          throw new Error('No audio data in payload for transcription');
        }

        // SURGICAL FIX: Direct supabase.functions.invoke with detailed logging
        console.log('=== DIRECT SUPABASE INVOKE START (NEW NOTE) ===');
        try {
          transcribeResponse = await supabase.functions.invoke('transcribe-audio', {
            body: payload
          });
          console.log('=== SUPABASE INVOKE RESPONSE (NEW NOTE) ===');
          console.log('Response:', transcribeResponse);
        } catch (invokeError: any) {
          console.error('=== SUPABASE INVOKE ERROR (NEW NOTE) ===');
          console.error('Error:', invokeError);
          throw invokeError;
        }
      } else {
        // Demo mode for unauthenticated users: Transcribe only, no note saving
        audioDebugger.log('demo_mode_transcription', 'info');
        
        // CRITICAL: Validate payload before sending
        const payload = {
          audioData: base64Data,
          language: 'en',
          mimeType: detectedMimeType || recordingData.type || 'audio/webm',
          demoMode: true
        };

        // SURGICAL FIX: Comprehensive payload debugging
        console.log('=== PAYLOAD DEBUG START (DEMO MODE) ===');
        console.log('Payload keys:', Object.keys(payload));
        console.log('audioData exists:', !!payload.audioData);
        console.log('audioData type:', typeof payload.audioData);
        console.log('audioData length:', payload.audioData?.length);
        console.log('audioData first 100 chars:', payload.audioData?.substring(0, 100));
        console.log('demoMode:', payload.demoMode);

        audioDebugger.log('network_payload_validation', 'info', {
          payloadKeys: Object.keys(payload),
          audioDataLength: payload.audioData?.length,
          hasAudioData: !!payload.audioData,
          demoMode: payload.demoMode,
          audioDataType: typeof payload.audioData,
          payloadSize: JSON.stringify(payload).length
        });

        if (!payload.audioData) {
          throw new Error('No audio data in payload for transcription');
        }
        
        // SURGICAL FIX: Direct supabase.functions.invoke with detailed logging
        console.log('=== DIRECT SUPABASE INVOKE START (DEMO MODE) ===');
        try {
          transcribeResponse = await supabase.functions.invoke('transcribe-audio', {
            body: payload
          });
          console.log('=== SUPABASE INVOKE RESPONSE (DEMO MODE) ===');
          console.log('Response:', transcribeResponse);
        } catch (invokeError: any) {
          console.error('=== SUPABASE INVOKE ERROR (DEMO MODE) ===');
          console.error('Error:', invokeError);
          throw invokeError;
        }
      }

      if (transcribeResponse.error) {
        audioDebugger.log('transcription_failed', 'error', transcribeResponse.error);
        
        // Update note status to failed (only if we created a note for authenticated users)
        if (note && isAuthenticated) {
          await supabase.from('voice_notes').update({
            status: 'failed',
            processing_metadata: {
              error: transcribeResponse.error.message,
              sessionId
            }
          }).eq('id', note.id);
        }

        // Provide more specific error messages based on error content
        const errorMessage = transcribeResponse.error.message;
        if (errorMessage?.includes('OpenAI API') || errorMessage?.includes('API key')) {
          throw new Error('OpenAI API key not configured. Please contact support.');
        } else if (errorMessage?.includes('Unauthorized')) {
          throw new Error('Authentication failed. Please sign in again.');
        } else if (errorMessage?.includes('Invalid base64')) {
          throw new Error('Audio data corrupted during processing. Please try recording again.');
        } else if (errorMessage?.includes('too large')) {
          throw new Error('Audio file too large. Please record a shorter message.');
        } else if (errorMessage?.includes('too small')) {
          throw new Error('Audio file too small. Please record for at least 1 second.');
        } else if (errorMessage?.includes('Network error')) {
          throw new Error('Network connection failed. Please check your internet and try again.');
        } else {
          throw new Error(`Transcription failed: ${errorMessage}`);
        }
      }

      audioDebugger.log('transcription_success', 'success', {
        transcriptLength: transcribeResponse.data?.transcript?.length,
        requestId: transcribeResponse.data?.requestId
      });

      // Update note with transcription (only if we created a note for authenticated users)
      if (note && isAuthenticated) {
        const { error: updateError } = await supabase.from('voice_notes').update({
          transcription: transcribeResponse.data.transcript,
          content: transcribeResponse.data.transcript,
          status: 'completed',
          processing_metadata: {
            sessionId,
            requestId: transcribeResponse.data.requestId,
            processingTime: transcribeResponse.data.processingTime
          }
        }).eq('id', note.id);
        
        if (updateError) {
          audioDebugger.log('note_update_failed', 'error', updateError, `Failed to update note: ${updateError.message}`);
          throw new Error(`Failed to update note: ${updateError.message}`);
        }
        
        audioDebugger.log('note_update_success', 'success', { noteId: note.id });
      } else if (!isAuthenticated) {
        audioDebugger.log('demo_mode_complete', 'info', { transcriptLength: transcribeResponse.data.transcript.length });
      }

      audioDebugger.log('process_transcription_complete', 'success', {
        transcriptLength: transcribeResponse.data.transcript.length,
        totalTime: Date.now() - audioDebugger.getSessionLogs(sessionId)[0].timestamp
      });

      onTranscription?.(transcribeResponse.data.transcript, effectiveAppendMode);

      // Clean up audio data after successful transcription
      if (recordingData) {
        setRecordingData(null);
      }

    } catch (error: any) {
      const errorDebugger = AudioDebugger.getInstance();
      errorDebugger.log('process_transcription_error', 'error', {
        errorType: error.constructor.name,
        errorMessage: error.message,
        errorStack: error.stack
      }, error.message);

      // Enhanced error messaging
      if (error.message?.includes('Failed to fetch') || error.message?.includes('Network error')) {
        toast.error("Network connection failed - Please check your internet connection and try again");
      } else if (error.message?.includes('User not authenticated')) {
        toast.error("Please sign in to use voice recording");
      } else if (error.message?.includes('Failed to create note')) {
        toast.error("Database error - Unable to save voice note. Please try again.");
      } else if (error.message?.includes('Audio validation failed')) {
        toast.error(`Audio validation failed: ${error.message}`);
      } else if (error.message?.includes('Base64 validation failed')) {
        toast.error("Audio data corrupted during processing. Please try recording again.");
      } else if (error.message?.includes('FileReader')) {
        toast.error("Failed to process audio file. Please try recording again.");
      } else {
        toast.error(`Recording processing failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <>
      <Card className="p-8 text-center gradient-card shadow-lg relative select-none">

        {/* Recording Button */}
        <div className="mb-4">
          {!isRecording ? <Button 
              onClick={startRecording} 
              variant="recording" 
              size="icon-lg" 
              className={`record-button rounded-full h-20 w-20 mb-4 ${isProcessing ? 'processing' : ''}`}
              disabled={isProcessing}
            >
              <img src="/lovable-uploads/574f6963-6e94-4033-8aeb-9c2980cce54c.png" alt="Record" className="h-10 w-auto" />
            </Button> : <Button 
              onClick={stopRecording} 
              variant="destructive" 
              size="icon-lg" 
              className="record-button recording stop-ripple rounded-full h-20 w-20 mb-4"
            >
              <Square className="h-8 w-8" />
            </Button>}
        </div>


        {/* Status Text */}
        <div className="mb-4 relative">
          {!isRecording && !isProcessing && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 justify-center">
                <p className="text-sm text-muted-foreground text-center">
                  {selectedNote && !manualNewNoteMode ? `Add to: ${selectedNote.title}` : 'Click the mic to start recording'}
                </p>
                
                {/* Always visible Help Button */}
                <VoiceRecorderHelp isAuthenticated={true} />
              </div>
              
              {/* Toggle button when note is selected */}
              {selectedNote && (
                <Button
                  variant={!manualNewNoteMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setManualNewNoteMode(!manualNewNoteMode)}
                  className="text-xs"
                >
                  {!manualNewNoteMode ? "📎 Append Mode" : "➕ New Note Mode"}
                </Button>
              )}
            </div>
          )}
          
          {isRecording && (
            <p className="text-sm font-medium text-primary text-center">
              {effectiveAppendMode && selectedNote ? 'Recording addition...' : 'Recording...'} {formatTime(recordingTime)}
            </p>
          )}
          
          {isProcessing && <div className="space-y-2">
              <p className="text-sm font-medium text-primary">
                {effectiveAppendMode && selectedNote ? 'Processing addition...' : 'Processing your recording...'}
              </p>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>}
        </div>

      </Card>
    </>
  );
};

export default VoiceRecorder;
