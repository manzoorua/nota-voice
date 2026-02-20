import * as React from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
  company?: string;
  subscription_status?: string;
  trial_ends_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'user' | 'guest';
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  userRole: UserRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithProvider: (provider: 'google' | 'github') => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any; data?: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
  refreshRole: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (requiredRole: string) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isUser: boolean;
  isPremium: boolean;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
  skipAuth?: boolean;
}

export const AuthProvider = ({ children, skipAuth = false }: AuthProviderProps) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [userRole, setUserRole] = React.useState<UserRole | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [adminStatus, setAdminStatus] = React.useState(false);
  const [passActive, setPassActive] = React.useState(false);
  const [passExpiresAt, setPassExpiresAt] = React.useState<string | null>(null);

  // Fetch user profile from database
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle to avoid errors when no profile exists
      
      if (error) {
        console.warn('Error fetching profile:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.warn('Error fetching profile:', error);
      return null;
    }
  };

  // Fetch user role from database
  const fetchUserRole = async (userId: string): Promise<UserRole | null> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle to avoid errors when no role exists
      
      if (error) {
        console.warn('Error fetching user role:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.warn('Error fetching user role:', error);
      return null;
    }
  };

  // Admin check via RPC (covers any admin role like system_admin, admin, developer, etc.)
  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('is_admin', { _user_id: userId });
      if (error) {
        console.warn('Error checking admin status:', error);
        setAdminStatus(false);
        return;
      }
      setAdminStatus(!!data);
    } catch (err) {
      console.warn('Admin status check failed:', err);
      setAdminStatus(false);
    }
  };

  const checkPassActive = React.useCallback(async (userId?: string) => {
    try {
      const targetId = userId || user?.id;
      if (!targetId) {
        setPassActive(false);
        setPassExpiresAt(null);
        return;
      }
      const { data, error } = await supabase.rpc('check_pass_active', { _user_id: targetId });
      if (error) {
        console.warn('Error checking pass status:', error);
        setPassActive(false);
        setPassExpiresAt(null);
        return;
      }
      const anyData = data as any;
      const active = typeof anyData?.active === 'boolean' ? anyData.active : false;
      const expiresAt = anyData?.expires_at ?? null;
      setPassActive(active);
      setPassExpiresAt(expiresAt);
    } catch (err) {
      console.warn('Pass status check failed:', err);
      setPassActive(false);
      setPassExpiresAt(null);
    }
  }, [user]);

  // Set up auth state listener and session management
  React.useEffect(() => {
    // Skip auth initialization for public routes
    if (skipAuth) {
      setLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);

        // Only synchronous state updates here to prevent auth flow interruption
        setSession(session);
        setUser(session?.user ?? null);

        if (!session?.user) {
          // Clear profile and role if no user
          setProfile(null);
          setUserRole(null);
          setAdminStatus(false);
          setPassActive(false);
          setPassExpiresAt(null);
        }

        // Always set loading to false after auth state change
        setLoading(false);

        // SECURITY FIX: Use Promise.all to eliminate race conditions
        if (session?.user) {
          Promise.all([
            fetchProfile(session.user.id),
            fetchUserRole(session.user.id)
          ]).then(([profileData, roleData]) => {
            if (profileData) setProfile(profileData);
            if (roleData) setUserRole(roleData);
            checkAdminStatus(session.user.id);
            checkPassActive(session.user.id);
          }).catch(err => {
            console.warn('Failed to fetch user data after auth:', err);
          });
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // SECURITY FIX: Use Promise.all for initial session check
        Promise.all([
          fetchProfile(session.user.id),
          fetchUserRole(session.user.id)
        ]).then(([profileData, roleData]) => {
          if (profileData) setProfile(profileData);
          if (roleData) setUserRole(roleData);
          checkAdminStatus(session.user.id);
          checkPassActive(session.user.id);
        }).catch(err => {
          console.warn('Failed to fetch user data on init:', err);
        });
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [skipAuth]);

  const signUp = React.useCallback(async (email: string, password: string, fullName?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/app`;
      
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName || '',
            email: email
          }
        }
      });
      
      // Track referral in the background (non-blocking)
      if (!error && signUpData?.user?.id) {
        setTimeout(async () => {
          try {
            const { trackReferralUsage } = await import('@/utils/referralUtils');
            await trackReferralUsage(signUpData.user.id);
          } catch (err) {
            console.warn('Referral tracking failed:', err);
            // Don't block signup for referral tracking failures
          }
        }, 0);
      }
      
      return { error };
    } catch (error) {
      console.error('SignUp error:', error);
      return { error };
    }
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      return { error };
    } catch (error) {
      console.error('SignIn error:', error);
      return { error };
    }
  }, []);

  const signInWithProvider = React.useCallback(async (provider: 'google' | 'github') => {
    try {
      const redirectUrl = `${window.location.origin}/app`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        }
      });

      return { error };
    } catch (error: any) {
      console.error(`${provider} signIn error:`, error);
      return { error };
    }
  }, []);

  const signOut = React.useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('SignOut error:', error);
      }
    } catch (error) {
      console.error('SignOut error:', error);
    }
  }, []);

  const resetPassword = React.useCallback(async (email: string) => {
    try {
      // SECURITY FIX: Use supabase.functions.invoke instead of direct HTTP call
      const { data, error } = await supabase.functions.invoke('enhanced-password-reset', {
        body: {
          email,
          redirectTo: `${window.location.origin}/reset-password`
        }
      });

      if (error) {
        console.error('Reset password error:', error);
        return { 
          error: { 
            message: error.message || 'Password reset failed',
            code: 'FUNCTION_ERROR'
          } 
        };
      }

      if (data.error) {
        return { 
          error: { 
            message: data.message || data.error || 'Password reset failed',
            code: data.code,
            attemptsRemaining: data.attemptsRemaining,
            lockedUntil: data.lockedUntil
          } 
        };
      }

      return { 
        error: null,
        data: {
          message: data.message,
          attemptsRemaining: data.attemptsRemaining
        }
      };
    } catch (error: any) {
      console.error('Reset password error:', error);
      return { 
        error: { 
          message: 'Network error. Please check your connection and try again.',
          code: 'NETWORK_ERROR'
        } 
      };
    }
  }, []);

  const updatePassword = React.useCallback(async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      return { error };
    } catch (error) {
      console.error('Update password error:', error);
      return { error };
    }
  }, []);

  const updateProfile = React.useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      
      if (!error && profile) {
        setProfile({ ...profile, ...updates });
      }
      
      return { error };
    } catch (error) {
      console.error('Update profile error:', error);
      return { error };
    }
  }, [user, profile]);

  const refreshProfile = React.useCallback(async () => {
    if (!user) return;
    
    const freshProfile = await fetchProfile(user.id);
    setProfile(freshProfile);
  }, [user]);

  const refreshRole = React.useCallback(async () => {
    if (!user) return;
    
    const freshRole = await fetchUserRole(user.id);
    setUserRole(freshRole);
  }, [user]);

  // Role checking functions
  const hasRole = React.useCallback((role: string) => {
    return userRole?.role === role;
  }, [userRole]);

  const hasPermission = React.useCallback((requiredRole: string) => {
    if (!userRole) return false;
    
    const roleHierarchy = {
      'guest': 1,
      'user': 2,
      'moderator': 3,
      'admin': 4
    };
    
    const userLevel = roleHierarchy[userRole.role as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;
    
    return userLevel >= requiredLevel;
  }, [userRole]);

  // Derived state
  const isAdmin = adminStatus;
  const isManager = hasRole('moderator') || isAdmin; // Map moderator to manager for backwards compatibility
  const isUser = hasRole('user') || isManager;
  const hasSubPremium = ['premium', 'pro', 'enterprise'].includes(profile?.subscription_status || '');
  const isPremium = hasSubPremium || passActive || isAdmin;

  const value = React.useMemo(() => ({
    user,
    session,
    profile,
    userRole,
    loading,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshProfile,
    refreshRole,
    hasRole,
    hasPermission,
    isAdmin,
    isManager,
    isUser,
    isPremium,
  }), [
    user, 
    session, 
    profile, 
    userRole,
    loading, 
    signUp, 
    signIn, 
    signInWithProvider,
    signOut, 
    resetPassword,
    updatePassword,
    updateProfile,
    refreshProfile,
    refreshRole,
    hasRole,
    hasPermission,
    isAdmin,
    isManager,
    isUser,
    isPremium
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};