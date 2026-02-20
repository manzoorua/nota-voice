import * as React from "react";
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import Link from '@/components/navigation/Link';
import { Button } from '@/components/ui/button';
import { Mic, Mail, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const EmailConfirmation = () => {
  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const { user } = useAuth();

  // Check if we're in development mode
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname.includes('lovableproject.com');

  useEffect(() => {
    // Get email from URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    const storedEmail = localStorage.getItem('pending_confirmation_email');
    
    setEmail(emailParam || storedEmail || '');
    
    // If user is already confirmed, process pending transcription and redirect
    if (user) {
      processPendingTranscription();
      window.location.href = '/app';
    }
  }, [user]);

  useEffect(() => {
    // Countdown timer for resend button
    let interval: NodeJS.Timeout;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const handleResendConfirmation = async () => {
    if (!email) {
      toast.error('No email address found. Please sign up again.');
      return;
    }

    if (!canResend) {
      toast.error(`Please wait ${countdown} seconds before resending.`);
      return;
    }

    setIsResending(true);

    try {
      const { error } = await supabase.functions.invoke('resend-confirmation', {
        body: { 
          email,
          redirectTo: `${window.location.origin}/app`
        }
      });

      if (error) {
        console.error('Resend confirmation error:', error);
        
        if (error.message?.includes('rate limit')) {
          toast.error('Too many requests. Please wait a few minutes before trying again.');
        } else {
          toast.error('Failed to resend confirmation email. Please try again.');
        }
      } else {
        toast.success('Confirmation email sent! Please check your inbox.');
        setResendCount(prev => prev + 1);
        setCanResend(false);
        setCountdown(30 + (resendCount * 15)); // Increasing delays: 30s, 45s, 60s...
      }
    } catch (error) {
      console.error('Resend confirmation error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const processPendingTranscription = async () => {
    const shouldProcess = localStorage.getItem('process_transcription_after_confirmation');
    const pendingTranscription = localStorage.getItem('pending_transcription');
    
    if (shouldProcess && pendingTranscription) {
      try {
        const transcriptionData = JSON.parse(pendingTranscription);
        
        // Create voice note record via edge function
        const { error } = await supabase.functions.invoke('process-voice-note', {
          body: {
            transcription: transcriptionData.content,
            title: `Voice Note from ${new Date(transcriptionData.timestamp).toLocaleString()}`,
            source: 'hero_transcription'
          }
        });

        if (!error) {
          toast.success('Your transcription has been saved to your voice notes!');
        }
        
        // Clean up localStorage
        localStorage.removeItem('pending_transcription');
        localStorage.removeItem('process_transcription_after_confirmation');
      } catch (error) {
        console.error('Error processing pending transcription:', error);
        // Don't show error to user as this is a background process
      }
    }
  };

  const handleDifferentEmail = () => {
    localStorage.removeItem('pending_confirmation_email');
    localStorage.removeItem('pending_transcription');
    localStorage.removeItem('process_transcription_after_confirmation');
    window.location.href = '/signup';
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Mic className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-gradient">NotaVoice</span>
        </Link>

        <div className="rounded-lg border bg-card text-card-foreground shadow-lg">
          <div className="flex flex-col space-y-1.5 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold leading-none tracking-tight">Check your email</h3>
            <p className="text-sm text-muted-foreground">
              We've sent a confirmation link to
            </p>
            {email && (
              <p className="text-sm font-medium text-foreground break-all">
                {email}
              </p>
            )}
          </div>

          <div className="p-6 pt-0">
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Click the confirmation link</p>
                    <p className="text-muted-foreground text-xs">Check your inbox and click the link to activate your account</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-muted-foreground">Check your spam folder</p>
                    <p className="text-muted-foreground text-xs">Sometimes confirmation emails end up in spam</p>
                  </div>
                </div>
              </div>

              {/* Development mode warning */}
              {isDevelopment && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Development Mode:</strong> You can disable email confirmation in your Supabase dashboard 
                    under Authentication → Settings → "Enable email confirmations" for faster testing.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleResendConfirmation}
                  disabled={isResending || !canResend}
                  variant="outline"
                  className="w-full"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : !canResend ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Resend in {countdown}s
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Resend confirmation email
                    </>
                  )}
                </Button>

                <Button 
                  variant="ghost" 
                  onClick={handleDifferentEmail}
                  className="w-full text-sm"
                >
                  Use a different email address
                </Button>
              </div>

              {resendCount > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Confirmation email sent {resendCount} time{resendCount > 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="text-center mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Already confirmed your email?{' '}
                <Link to="/signin" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmation;