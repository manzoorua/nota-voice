import * as React from "react";
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireAdmin = false,
  redirectTo
}) => {
  const { user, loading, isAdmin } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // SECURITY FIX: Use secure navigation instead of window.location.href
  const secureNavigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new CustomEvent('navigate', { detail: { path } }));
    }
  };

  // If authentication is required but user is not logged in
  if (requireAuth && !user) {
    const target = redirectTo || "/signin";
    secureNavigate(target);
    return null;
  }

  // If admin access is required but user is not admin
  if (requireAdmin && !isAdmin) {
    secureNavigate('/app');
    return null;
  }

  // If user is logged in but trying to access auth pages, redirect to app
  if (!requireAuth && user && ['/signin', '/signup', '/forgot-password'].includes(window.location.pathname)) {
    secureNavigate('/app');
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;