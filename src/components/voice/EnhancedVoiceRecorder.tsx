import React, { useState, useRef, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserSettings } from '@/hooks/useUserSettings';

interface EnhancedVoiceRecorderProps {
  onTranscription: (text: string, noteData: any) => void;
}

const EnhancedVoiceRecorder: React.FC<EnhancedVoiceRecorderProps> = ({ onTranscription }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedStyle, setSelectedStyle] = useState('clean');
  
  const { settings } = useUserSettings();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const mimeTypeRef = useRef<string>("");

  // Environment diagnostics
  const isIframe = typeof window !== 'undefined' && window.top !== window.self;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'zh', label: 'Chinese' },
  ];

  const styles = [
    { value: 'clean', label: 'Clean (Remove filler words)' },
    { value: 'bullet', label: 'Bullet Points' },
    { value: 'summary', label: 'Summary' },
    { value: 'formal', label: 'Formal' },
    { value: 'casual', label: 'Casual' },
  ];

  // Use user settings as defaults
  React.useEffect(() => {
    if (settings) {
      setSelectedLanguage(settings.output_language || 'en');
      setSelectedStyle(settings.default_ai_style || 'clean');
    }
  }, [settings]);

  // Helpers for MIME support & diagnostics
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
    for (const t of candidates) if (isSupported(t)) return t;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return isIOS ? 'audio/mp4' : 'audio/webm';
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

  const startRecording = useCallback(async () => {
    try {
      // iOS Safari in iframes blocks mic access
      if (isIOS && isIframe) {
        toast.error('iOS Safari blocks microphone in embedded previews. Open this page in a new tab.');
        return;
      }

      // Attempt getUserMedia immediately on user gesture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mime = getSupportedMimeType();
      mimeTypeRef.current = mime;

      recordedChunks.current = [];
      const options = mime ? { mimeType: mime } as MediaRecorderOptions : undefined;
      mediaRecorder.current = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        processRecording();
      };

      mediaRecorder.current.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingInterval.current = setInterval(() => {
        setRecordingTime(time => time + 1);
      }, 1000);

    } catch (error: any) {
      console.error('Error starting recording:', error);
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
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
    }
  }, [isRecording]);

  const processRecording = async () => {
    if (recordedChunks.current.length === 0) {
      toast.error("No audio was recorded. Please try again.");
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Preparing audio...');

    try {
      // Create audio blob
      const mime = mimeTypeRef.current || (recordedChunks.current[0] as any)?.type || 'audio/webm';
      const audioBlob = new Blob(recordedChunks.current, { type: mime });
      
      // Enhanced security validations
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      const maxDuration = 300; // 5 minutes
      const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg'];
      
      // File size validation
      if (audioBlob.size > maxFileSize) {
        throw new Error(`Audio file too large (${(audioBlob.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed: 10MB`);
      }
      
      // Duration validation
      if (recordingTime > maxDuration) {
        throw new Error(`Recording too long (${Math.round(recordingTime / 60)} minutes). Maximum allowed: 5 minutes`);
      }
      
      // File type validation (basic MIME type check)
      if (!allowedTypes.includes(audioBlob.type)) {
        console.warn(`Unexpected MIME type: ${audioBlob.type}, proceeding with caution`);
      }
      
      // Minimum duration check
      if (recordingTime < 1) {
        throw new Error('Recording too short (minimum 1 second)');
      }
      
      // Convert to base64
      setProcessingStep('Converting audio...');
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const base64Data = base64Audio.split(',')[1];
        
        // Additional validation on base64 data
        if (!base64Data || base64Data.length < 100) {
          throw new Error('Invalid audio data');
        }

        // Send to processing function
        setProcessingStep('Processing with AI...');
        const { data, error } = await supabase.functions.invoke('process-voice-note', {
          body: {
            audioData: base64Data,
            language: selectedLanguage,
            style: selectedStyle,
            title: `Voice Note ${new Date().toLocaleString()}`,
            duration: recordingTime,
            fileSize: audioBlob.size,
            mimeType: audioBlob.type
          }
        });

        if (error) throw error;

        if (data.success) {
          setProcessingStep('Complete!');
          const transcription = data.data?.enhanced_content || data.data?.transcription || 'Processing completed';
          onTranscription(transcription, data.data);
          
          toast.success("Your voice note has been processed successfully!");
        } else {
          throw new Error(data.error || 'Processing failed');
        }
      };
      
      reader.onerror = () => {
        throw new Error('Failed to read audio file');
      };

    } catch (error) {
      console.error('Processing error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to process recording. Please try again.");
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          {isIframe && (
            <div className="p-3 rounded-md bg-accent text-sm text-muted-foreground">
              Microphone may be blocked in embedded previews.
              <Button variant="outline" size="sm" className="ml-2" onClick={() => window.open(location.href, '_blank', 'noopener')}>
                Open in new tab
              </Button>
            </div>
          )}
          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="language">Language</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map(lang => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="style">AI Style</Label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {styles.map(style => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recording Controls */}
          <div className="text-center space-y-4">
            {isRecording && (
              <div className="space-y-2">
                <div className="text-lg font-mono">{formatTime(recordingTime)}</div>
                <Progress value={(recordingTime / 300) * 100} className="max-w-xs mx-auto" />
                <div className="text-sm text-muted-foreground">
                  {recordingTime >= 300 ? 'Maximum recording time reached' : `${300 - recordingTime}s remaining`}
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                <div className="text-sm text-muted-foreground">{processingStep}</div>
              </div>
            )}

            <div className="flex justify-center">
              {!isRecording && !isProcessing ? (
                <Button
                  onClick={startRecording}
                  size="lg"
                  className="w-16 h-16 rounded-full"
                >
                  <Mic className="w-16 h-16" />
                </Button>
              ) : isRecording ? (
                <Button
                  onClick={stopRecording}
                  size="lg"
                  variant="destructive"
                  className="w-16 h-16 rounded-full"
                  disabled={recordingTime >= 300}
                >
                  <Square className="w-6 h-6" />
                </Button>
              ) : (
                <Button size="lg" className="w-16 h-16 rounded-full" disabled>
                  <Loader2 className="w-6 h-6 animate-spin" />
                </Button>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              {!isRecording && !isProcessing && 'Click to start recording'}
              {isRecording && 'Click to stop recording'}
              {isProcessing && 'Processing your voice note...'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedVoiceRecorder;