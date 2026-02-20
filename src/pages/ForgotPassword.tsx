import * as React from "react";
const { useState } = React;
import Link from '@/components/navigation/Link';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Mic, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RateLimitDisplay } from '@/components/auth/RateLimitDisplay';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    attemptsRemaining?: number;
    lockedUntil?: string;
  }>({});
  const { resetPassword } = useAuth();
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await resetPassword(email);
      
      if (result.error) {
        const { message, code, attemptsRemaining, lockedUntil } = result.error;
        
        // Handle specific error types with detailed messages
        switch (code) {
          case 'RATE_LIMITED':
            const timeRemaining = lockedUntil ? 
              Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000) : 60;
            toast.error(`${message} Please wait ${timeRemaining} minutes.`);
            break;
          case 'INVALID_EMAIL_FORMAT':
            toast.error('Please enter a valid email address');
            break;
          case 'SUPABASE_RATE_LIMITED':
            toast.error('Too many requests. Please wait a few minutes before trying again.');
            break;
          case 'NETWORK_ERROR':
            toast.error('Network error. Please check your connection and try again.');
            break;
          default:
            toast.error(message || 'Failed to send password reset email');
        }
        
        // Update rate limit info
        setRateLimitInfo({
          attemptsRemaining,
          lockedUntil
        });
      } else {
        setIsSubmitted(true);
        toast.success(result.data?.message || 'Password reset link sent to your email');
        
        // Update rate limit info
        setRateLimitInfo({
          attemptsRemaining: result.data?.attemptsRemaining
        });
      }
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
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
              <h3 className="text-2xl font-semibold leading-none tracking-tight">Check your email</h3>
              <p className="text-sm text-muted-foreground">
                We've sent a password reset link to {email}
              </p>
            </div>
            <div className="p-6 pt-0 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setIsSubmitted(false)}
                className="w-full mb-4"
              >
                Try different email
              </Button>
              <Link to="/signin" className="text-primary hover:underline font-medium">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <h3 className="text-2xl font-semibold leading-none tracking-tight">Reset your password</h3>
            <p className="text-sm text-muted-foreground">
              Enter your email address and we'll send you a password reset link
            </p>
          </div>
          <div className="p-6 pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <RateLimitDisplay 
                attemptsRemaining={rateLimitInfo.attemptsRemaining}
                lockedUntil={rateLimitInfo.lockedUntil}
              />
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading || !!rateLimitInfo.lockedUntil}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isLoading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/signin" className="text-primary hover:underline font-medium">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;