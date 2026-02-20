import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Mic, 
  Square, 
  Wifi, 
  WifiOff,
  RotateCcw
} from "lucide-react";
import { toast } from 'sonner';
import { useGestures } from "@/hooks/useGestures";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { usePWA } from "@/hooks/usePWA";

interface MobileVoiceRecorderProps {
  onTranscription?: (text: string) => void;
  maxDuration?: number;
}

const MobileVoiceRecorder = ({ 
  onTranscription, 
  maxDuration = 180 // 3 minutes default
}: MobileVoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(30).fill(0));
  const [recordingData, setRecordingData] = useState<Blob | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const mimeTypeRef = useRef<string>("");
  const fileExtRef = useRef<string>("webm");

  // Environment diagnostics
  const isIframe = typeof window !== 'undefined' && window.top !== window.self;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  const { isOffline, saveOfflineNote, pendingNotes } = useOfflineStorage();
  const { isInstallable, installApp } = usePWA();

  // Enhanced gesture controls for mobile
  const gestureRef = useGestures({
    onTap: () => {
      if (!isRecording && !isProcessing) {
        startRecording();
      }
    },
    onLongPress: () => {
      if (isRecording) {
        stopRecording();
      } else {
        enterFullscreenMode();
      }
    },
    onSwipeUp: () => {
      if (!isRecording && isFullscreen) {
        exitFullscreenMode();
      }
    },
    onSwipeDown: () => {
      if (isFullscreen) {
        exitFullscreenMode();
      }
    },
    onSwipeLeft: () => {
      if (recordingData) {
        restartRecording();
      }
    },
    onSwipeRight: () => {
      // Reserved for future functionality
    },
    onDoubleTap: () => {
      if (!isRecording) {
        toggleFullscreen();
      }
    },
    threshold: 30,
    longPressDelay: 800
  });

  // Enhanced audio frequency monitoring
  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate overall audio level
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(average / 255 * 100);

    // Create frequency bands for waveform visualization
    const bands = 30;
    const bandSize = Math.floor(bufferLength / bands);
    const newFrequencyData: number[] = [];

    for (let i = 0; i < bands; i++) {
      const start = i * bandSize;
      const end = start + bandSize;
      const bandAverage = dataArray.slice(start, end).reduce((sum, value) => sum + value, 0) / bandSize;
      const intensity = (bandAverage / 255) * 100;
      // Add some randomization for more natural look when audio is low
      const finalIntensity = intensity > 5 ? intensity : Math.random() * 10;
      newFrequencyData.push(finalIntensity);
    }

    setFrequencyData(newFrequencyData);

    if (isRecording) {
      animationRef.current = requestAnimationFrame(monitorAudioLevel);
    }
  };
  // Helpers for MIME support and diagnostics
  const getSupportedMimeType = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/m4a',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mpeg',
      'audio/wav'
    ];
    const isSupported = (t: string) => typeof MediaRecorder !== 'undefined' && (MediaRecorder as any).isTypeSupported?.(t);
    for (const t of candidates) {
      if (isSupported(t)) return t;
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return isIOS ? 'audio/mp4' : 'audio/webm';
  };

  const getExtFromMime = (type: string) => {
    if (!type) return 'webm';
    if (type.includes('webm')) return 'webm';
    if (type.includes('mp4')) return 'mp4';
    if (type.includes('m4a') || type.includes('aac')) return 'm4a';
    if (type.includes('mpeg')) return 'mp3';
    if (type.includes('ogg')) return 'ogg';
    if (type.includes('wav')) return 'wav';
    return 'webm';
  };

  const preflightChecks = async () => {
    if (!window.isSecureContext) {
      toast.error('Microphone requires HTTPS. Please use the secure preview URL.');
      return false;
    }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      toast.error('Your browser does not support microphone recording.');
      return false;
    }
    if (window.top !== window.self) {
      toast.info('Microphone may be blocked in embedded views. Open in a new tab if recording fails.');
    }
    try {
      const anyNav: any = navigator as any;
      if (anyNav.permissions?.query) {
        const status = await anyNav.permissions.query({ name: 'microphone' as PermissionName });
        if (status.state === 'denied') {
          toast.error('Microphone permission denied in browser settings.');
          return false;
        }
      }
    } catch {}
    return true;
  };

  const startRecording = async () => {
    try {
      // iOS Safari in iframes blocks mic access
      if (isIOS && isIframe) {
        toast.error('iOS Safari blocks microphone in embedded previews. Open this page in a new tab.');
        return;
      }

      // Attempt getUserMedia immediately on user gesture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine supported MIME and extension
      const mime = getSupportedMimeType();
      mimeTypeRef.current = mime;
      fileExtRef.current = getExtFromMime(mime);

      // Setup audio context for enhanced frequency monitoring
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      // Create MediaRecorder with fallback
      const options = mime ? { mimeType: mime } as MediaRecorderOptions : undefined;
      const mr = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      const chunks: Blob[] = [];
      mr.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mimeTypeRef.current || 'audio/webm' });
        setRecordingData(blob);
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

      mr.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer and audio monitoring
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);

      monitorAudioLevel();

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
      }

      toast.success('Recording started');
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      const name = error?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        if (isIframe) {
          toast.error('Mic blocked in embedded view. Open in a new tab.');
        } else if (isIOS) {
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
      setAudioLevel(0);
      setFrequencyData(new Array(30).fill(0));
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }

      processRecording();
    }
  };

  const processRecording = async () => {
    setIsProcessing(true);
    
    setTimeout(async () => {
      setIsProcessing(false);
      const mockTranscription = "This is a sample transcription of your voice note. In a real implementation, this would be processed by an AI transcription service.";
      
      if (isOffline && recordingData) {
        try {
          await saveOfflineNote({
            title: `Voice Note ${new Date().toLocaleString()}`,
            content: mockTranscription,
            audioBlob: recordingData,
            createdAt: new Date().toISOString()
          });
          
          toast.success("Note saved offline - Your note will sync when you're back online");
        } catch (error) {
          toast.error("Failed to save offline - Please try again");
        }
      } else {
        onTranscription?.(mockTranscription);
        toast.success("Transcription complete! Your voice note has been converted to text");
      }
    }, 2000);
  };

  const restartRecording = () => {
    setRecordingData(null);
    setRecordingTime(0);
  };

  const enterFullscreenMode = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
    setIsFullscreen(true);
  };

  const exitFullscreenMode = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreenMode();
    } else {
      enterFullscreenMode();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (recordingTime / maxDuration) * 100;

  return (
    <Card 
      ref={gestureRef}
      className={`text-center gradient-card shadow-lg relative select-none transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none p-12' : 'p-8'
      }`}
    >
      {/* Top Status Bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Badge variant={isOffline ? "destructive" : "secondary"} className="flex items-center gap-1">
            {isOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            {isOffline ? "Offline" : "Online"}
          </Badge>
          
          {pendingNotes.length > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              {pendingNotes.length} pending
            </Badge>
          )}
        </div>

        {isInstallable && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={installApp}
            className="text-xs"
          >
            Install App
          </Button>
        )}
      </div>

      {isIframe && (
        <div className="mb-4 p-3 rounded-md bg-accent text-sm text-muted-foreground">
          Microphone may be blocked in embedded previews.
          <Button variant="outline" size="sm" className="ml-2" onClick={() => window.open(location.href, '_blank', 'noopener')}>
            Open in new tab
          </Button>
        </div>
      )}

      {/* Recording Progress */}
      {isRecording && (
        <div className="mb-6">
          <Progress value={progressPercentage} className="h-2 mb-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(recordingTime)}</span>
            <span>{formatTime(maxDuration)}</span>
          </div>
        </div>
      )}

      {/* Enhanced Audio Frequency Visualization */}
      {isRecording && (
        <div className="mb-6">
          <div className="flex justify-center items-end space-x-1 h-20">
            {frequencyData.map((intensity, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-75"
                style={{
                  width: '3px',
                  height: `${Math.max(6, (intensity / 100) * 80)}px`,
                  background: intensity > 20 
                    ? `linear-gradient(to top, hsl(var(--primary)), hsl(var(--primary-glow)))` 
                    : `hsl(var(--primary) / 0.5)`,
                  opacity: Math.max(0.4, intensity / 100),
                  animationDelay: `${i * 30}ms`,
                  transform: `scaleY(${Math.max(0.3, intensity / 100)})`,
                  filter: intensity > 50 ? 'brightness(1.2)' : 'brightness(0.8)'
                }}
              />
            ))}
          </div>
          
          {/* Audio level indicator */}
          <div className="mt-3 text-xs text-muted-foreground text-center">
            Audio Level: {Math.round(audioLevel)}%
          </div>
        </div>
      )}

      {/* Main Recording Button */}
      <div className="mb-6">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            variant="recording"
            size="icon-lg"
            className={`record-button rounded-full mb-4 ${isProcessing ? 'processing' : ''} ${
              isFullscreen ? 'h-32 w-32' : 'h-20 w-20'
            }`}
            disabled={isProcessing}
          >
            <Mic className={isFullscreen ? "h-20 w-20" : "h-16 w-16"} />
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            variant="destructive"
            size="icon-lg"
            className={`record-button recording stop-ripple rounded-full mb-4 ${
              isFullscreen ? 'h-32 w-32' : 'h-20 w-20'
            }`}
          >
            <Square className={isFullscreen ? "h-16 w-16" : "h-8 w-8"} />
          </Button>
        )}
      </div>

      {/* Status Messages */}
      <div className="mb-6">
        {!isRecording && !isProcessing && !recordingData && (
          <div className="space-y-2">
            <p className="text-lg text-muted-foreground">
              Tap to start recording
            </p>
            <p className="text-xs text-muted-foreground">
              Long press for fullscreen • Double tap to toggle view
            </p>
          </div>
        )}
        
        {isRecording && (
          <div className="space-y-2">
            <p className="text-lg font-medium text-primary">
              Recording... {formatTime(recordingTime)}
            </p>
            <p className="text-sm text-muted-foreground">
              Long press to stop • {formatTime(maxDuration - recordingTime)} remaining
            </p>
          </div>
        )}
        
        {isProcessing && (
          <div className="space-y-2">
            <p className="text-lg font-medium text-primary">
              Processing your recording...
            </p>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>

      {/* Recording Complete Status */}
      {recordingData && !isProcessing && (
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            <Button
              onClick={restartRecording}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Record Again
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Recording completed • Duration: {formatTime(recordingTime)}
          </p>
        </div>
      )}

      {/* Gesture Help */}
      {!isRecording && !isProcessing && (
        <div className="mt-6 text-xs text-muted-foreground space-y-1">
          <p>Long press: Fullscreen • Double tap: Toggle view</p>
          <p>Swipe left: Record again • Notes deleted after 7 days</p>
        </div>
      )}
    </Card>
  );
};

export default MobileVoiceRecorder;