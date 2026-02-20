import * as React from "react";
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEnvironment } from '@/hooks/useEnvironment';

interface EmailConfirmationStatusProps {
  email: string;
  onConfirmed?: () => void;
  onResendSuccess?: () => void;
}

type ConfirmationStatus = 'checking' | 'confirmed' | 'pending' | 'error';

export const EmailConfirmationStatus: React.FC<EmailConfirmationStatusProps> = ({
  email,
  onConfirmed,
  onResendSuccess
}) => {
  const [status, setStatus] = useState<ConfirmationStatus>('checking');
  const [isResending, setIsResending] = useState(false);
  const [lastResend, setLastResend] = useState<Date | null>(null);
  const [canResend, setCanResend] = useState(true);
  const { isDevelopment } = useEnvironment();

  useEffect(() => {
    checkConfirmationStatus();
    
    // Poll for confirmation status every 5 seconds
    const interval = setInterval(checkConfirmationStatus, 5000);
    
    return () => clearInterval(interval);
  }, [email]);

  useEffect(() => {
    // Manage resend cooldown
    if (lastResend) {
      const timeSinceResend = Date.now() - lastResend.getTime();
      const cooldownPeriod = 60000; // 1 minute
      
      if (timeSinceResend < cooldownPeriod) {
        setCanResend(false);
        const timeout = setTimeout(() => {
          setCanResend(true);
        }, cooldownPeriod - timeSinceResend);
        
        return () => clearTimeout(timeout);
      }
    }
  }, [lastResend]);

  const checkConfirmationStatus = async () => {
    try {
      // Check current session to see if email is confirmed
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        setStatus('error');
        return;
      }

      if (session && session.user && session.user.email_confirmed_at) {
        setStatus('confirmed');
        if (onConfirmed) {
          onConfirmed();
        }
      } else {
        setStatus('pending');
      }
    } catch (error) {
      console.error('Confirmation status check error:', error);
      setStatus('error');
    }
  };

  const handleResend = async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    
    try {
      const { error } = await supabase.functions.invoke('resend-confirmation', {
        body: { 
          email,
          redirectTo: `${window.location.origin}/app`
        }
      });

      if (error) {
        throw error;
      }

      toast.success('Confirmation email sent! Please check your inbox.');
      setLastResend(new Date());
      
      if (onResendSuccess) {
        onResendSuccess();
      }
    } catch (error: any) {
      console.error('Resend error:', error);
      
      if (error.message?.includes('rate limit')) {
        toast.error('Too many requests. Please wait before trying again.');
      } else {
        toast.error('Failed to resend confirmation email.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const renderStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <Clock className="w-4 h-4 text-muted-foreground animate-pulse" />;
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const renderStatusMessage = () => {
    switch (status) {
      case 'checking':
        return 'Checking confirmation status...';
      case 'confirmed':
        return 'Email confirmed! You can now sign in.';
      case 'pending':
        return 'Please check your email and click the confirmation link.';
      case 'error':
        return 'Unable to check confirmation status.';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'checking':
        return 'text-muted-foreground';
      case 'confirmed':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 text-sm ${getStatusColor()}`}>
        {renderStatusIcon()}
        <span>{renderStatusMessage()}</span>
      </div>

      {status === 'pending' && (
        <div className="space-y-2">
          <Button
            onClick={handleResend}
            disabled={!canResend || isResending}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isResending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Resend confirmation email
              </>
            )}
          </Button>

          {!canResend && (
            <p className="text-xs text-muted-foreground text-center">
              Please wait before resending
            </p>
          )}

          {isDevelopment && (
            <div className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border">
              <strong>Dev tip:</strong> Disable email confirmation in Supabase Dashboard → Auth → Settings for faster testing
            </div>
          )}
        </div>
      )}

      {status === 'confirmed' && (
        <Button
          onClick={() => window.location.href = '/signin'}
          className="w-full"
        >
          Continue to Sign In
        </Button>
      )}

      {status === 'error' && (
        <Button
          onClick={checkConfirmationStatus}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Check again
        </Button>
      )}
    </div>
  );
};