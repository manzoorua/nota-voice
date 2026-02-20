import * as React from "react";
import { useState } from 'react';
import Link from '@/components/navigation/Link';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Mic, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { updatePassword } = useAuth();
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced password validation
    if (!password || !confirmPassword) {
      toast.error('Please fill in both password fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      toast.error('Password must contain uppercase, lowercase, and numbers');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await updatePassword(password);
      
      if (error) {
        // Enhanced error handling
        let errorMessage = error.message;
        
        if (error.message.includes('session')) {
          errorMessage = 'Your password reset link has expired. Please request a new one.';
          toast.error(errorMessage);
          setTimeout(() => {
            window.location.href = '/forgot-password';
          }, 2000);
          return;
        } else if (error.message.includes('same')) {
          errorMessage = 'New password must be different from your current password';
        } else if (error.message.includes('weak')) {
          errorMessage = 'Password is too weak. Please choose a stronger password';
        }
        
        toast.error(errorMessage);
      } else {
        toast.success('Password updated successfully!');
        
        // Clear any stored reset tokens
        localStorage.removeItem('supabase.auth.token');
        
        setTimeout(() => {
          window.location.href = '/signin';
        }, 1000);
      }
    } catch (error: any) {
      console.error('Password update error:', error);
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Something went wrong. Please try again or request a new reset link.');
      }
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
            <h3 className="text-2xl font-semibold leading-none tracking-tight">Create new password</h3>
            <p className="text-sm text-muted-foreground">
              Enter your new password below
            </p>
          </div>
          <div className="p-6 pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
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
                <PasswordStrengthIndicator password={password} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isLoading ? 'Updating...' : 'Update password'}
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

export default ResetPassword;