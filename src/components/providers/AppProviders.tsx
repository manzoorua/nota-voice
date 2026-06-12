import React from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from '@/hooks/useAuth';
import { OrganizationProvider } from '@/hooks/useOrganization';
import { QueueStatusProvider } from '@/lib/offline-queue/react';

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

  // Authenticated routes - full provider stack with lazy organization loading.
  // The offline queue is only meaningful for authenticated users creating notes,
  // so QueueStatusProvider wraps the authenticated children here (and never the
  // public/skipAuth branch). Mounting it initializes the OfflineQueue on app
  // mount and shuts it down on unmount (Req 6.2, 8.1).
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrganizationProvider>
          <QueueStatusProvider>
            {children}
          </QueueStatusProvider>
        </OrganizationProvider>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
};