import * as React from "react";
import { useState, useEffect } from 'react';
import Link from '@/components/navigation/Link';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Mic, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { user, signIn } = useAuth();
  
  // SECURITY FIX: Use secure navigation helper
  const secureNavigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new CustomEvent('navigate', { detail: { path } }));
    }
  };

  useEffect(() => {
    // SECURITY FIX: Use secure navigation instead of window.location.href
    if (user) {
      secureNavigate('/app');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    console.log('Attempting to sign in with:', { email, supabaseUrl: 'https://ihnvrzwjxexdminrqivs.supabase.co' });

    try {
      const { error } = await signIn(email, password);
      
      console.log('Sign in response:', { error: error?.message, errorCode: error?.status });
      
      if (error) {
        // Log full error details for debugging
        console.error('Full sign in error:', error);
        
        if (error.message?.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message?.includes('Email not confirmed')) {
          // Store email for confirmation page
          localStorage.setItem('pending_confirmation_email', email);
          toast.error('Please check your email and click the confirmation link before signing in.', {
            action: {
              label: 'Resend email',
              onClick: () => {
                secureNavigate(`/email-confirmation?email=${encodeURIComponent(email)}`);
              }
            }
          });
        } else if (error.message?.includes('Too many requests')) {
          toast.error('Too many login attempts. Please wait a moment and try again.');
        } else if (error.message?.includes('User already registered')) {
          toast.error('This email is already registered. Try signing in instead of signing up.');
        } else {
          toast.error(`Sign in failed: ${error.message || 'Unknown error'}`);
        }
      } else {
        console.log('Sign in successful!');
        toast.success('Welcome back!');
        
        // SECURITY FIX: Use secure navigation instead of window.location.href
        setTimeout(() => {
          secureNavigate('/app');
        }, 500);
      }
    } catch (error) {
      console.error('SignIn error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
            <h3 className="text-2xl font-semibold leading-none tracking-tight">Welcome back</h3>
            <p className="text-sm text-muted-foreground">
              Sign in to access your voice notes
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
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="remember" className="text-sm">
                  Remember me
                </Label>
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            {/* Enhanced Signup CTA */}
            <div className="text-center mt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Don't have an account?
              </p>
              <Button 
                variant="hero" 
                className="w-full" 
                onClick={() => secureNavigate('/signup')}
              >
                Create Free Account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;