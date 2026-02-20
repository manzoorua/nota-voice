import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Square } from "lucide-react";
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VoiceRecorderHelp } from "@/components/ui/VoiceRecorderHelp";
import { formatTime, MAX_RECORDING_TIME } from "@/utils/voiceRecorderUtils";

interface PublicVoiceRecorderProps {
  onTranscription?: (text: string, appendMode?: boolean) => void;
  showHomePageHelp?: boolean;
}

interface VoiceNote {
  id: string;
  title: string;
}

const PublicVoiceRecorder: React.FC<PublicVoiceRecorderProps> = ({
  onTranscription,
  showHomePageHelp = false
}) => {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [audioChunks, setAudioChunks] = React.useState<Blob[]>([]);
  const [mediaRecorder, setMediaRecorder] = React.useState<MediaRecorder | null>(null);
  
  const intervalRef = React.useRef<number | null>(null);
  const recordingTimeRef = React.useRef(0);

  // Free tier limits for public users
  const timeRemaining = Math.max(0, MAX_RECORDING_TIME - recordingTime);
  const timeRemainingMinutes = Math.floor(timeRemaining / 60);
  const timeRemainingSeconds = timeRemaining % 60;

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startTimer = () => {
    intervalRef.current = window.setInterval(() => {
      recordingTimeRef.current += 1;
      setRecordingTime(recordingTimeRef.current);
      
      if (recordingTimeRef.current >= MAX_RECORDING_TIME) {
        stopRecording();
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const resetTimer = () => {
    stopTimer();
    recordingTimeRef.current = 0;
    setRecordingTime(0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        } 
      });

      const recorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm;codecs=opus' 
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
        setAudioChunks(chunks);
        await processRecording(audioBlob);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      setAudioChunks([]);
      recorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsPaused(false);
      resetTimer();
      startTimer();
      
      toast.success("Recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Error accessing microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();
      toast.info("Recording stopped, processing...");
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    if (audioBlob.size === 0) {
      toast.error("No audio recorded");
      return;
    }

    setIsProcessing(true);
    
    try {
      // Convert to base64 format as expected by the edge function
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string;
          const base64Data = base64Audio.split(',')[1];
          
          if (!base64Data || base64Data.length < 100) {
            throw new Error('Invalid audio data');
          }

          const { data, error } = await supabase.functions.invoke('transcribe-audio', {
            body: {
              audioData: base64Data,
              demoMode: true,
              language: 'en',
              mimeType: audioBlob.type || 'audio/webm'
            }
          });

          if (error) throw error;

          if (data && data.transcript) {
            onTranscription?.(data.transcript);
            toast.success("Transcription completed!");
            setIsProcessing(false);
          } else {
            throw new Error("No transcription received");
          }
        } catch (error) {
          console.error("Error processing audio:", error);
          toast.error("Failed to process recording. Please try again.");
          setIsProcessing(false);
        }
      };
      
      reader.onerror = () => {
        toast.error("Failed to read audio file");
        setIsProcessing(false);
      };

    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Failed to process recording. Please try again.");
      setIsProcessing(false);
    }
  };


  const getRecordingStatusText = () => {
    if (isProcessing) return "Processing your recording...";
    if (isRecording && !isPaused) return "Recording in progress...";
    if (isPaused) return "Recording paused";
    return "Click the mic to start recording";
  };


  return (
    <>
      <TooltipProvider>
        <Card className="p-4 sm:p-6 bg-card/50 backdrop-blur border-primary/20">
          <div className="flex flex-col items-center space-y-4 sm:space-y-6">

            {/* Recording Controls */}
            <div className="flex flex-col items-center space-y-4 w-full">
              {/* Record Button */}
              <Button
                variant={isRecording ? "destructive" : "recording"}
                size="icon-lg"
                className={`record-button rounded-full h-20 w-20 mb-4 ${isProcessing ? 'animate-pulse' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
              >
                {isRecording ? (
                  <Square className="h-6 w-6 text-destructive-foreground" />
                ) : (
                  <img 
                    src="/lovable-uploads/574f6963-6e94-4033-8aeb-9c2980cce54c.png" 
                    alt="Microphone" 
                    className="h-10 w-auto"
                  />
                )}
              </Button>

              {/* Status Text with Help Button */}
              {!isRecording && !isProcessing && (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {getRecordingStatusText()}
                  </p>
                  {showHomePageHelp && (
                    <VoiceRecorderHelp showTooltip={true} isAuthenticated={false} />
                  )}
                </div>
              )}

              {/* Dynamic Status and Timer */}
              {(isRecording || isProcessing) && (
                <div className="flex flex-col items-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {getRecordingStatusText()}
                  </p>
                  
                  {isRecording && (
                    <div className="text-center space-y-1">
                      <div className="text-2xl font-mono font-bold text-primary">
                        {formatTime(recordingTime)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {timeRemainingMinutes}:{timeRemainingSeconds.toString().padStart(2, '0')} remaining
                      </div>
                    </div>
                  )}
                  
                  {/* Free Tier Info - only show when recording */}
                  {isRecording && (
                    <Badge variant="secondary" className="text-xs">
                      Free: {MAX_RECORDING_TIME / 60} min limit
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}
          </div>
        </Card>
      </TooltipProvider>
    </>
  );
};

export default PublicVoiceRecorder;