import React from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from '@/hooks/useAuth';
import { OrganizationProvider } from '@/hooks/useOrganization';

interface AppProvidersProps {
  children: React.ReactNode;
  skipAuth?: boolean;
}

// Create QueryClient with enhanced configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

// Optimized providers - completely skip auth providers for public routes
export const AppProviders: React.FC<AppProvidersProps> = ({ children, skipAuth = false }) => {
  if (skipAuth) {
    // Public routes - minimal providers only
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    );
  }

  // Authenticated routes - full provider stack with lazy organization loading
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrganizationProvider>
          {children}
        </OrganizationProvider>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
};