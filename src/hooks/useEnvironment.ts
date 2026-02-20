import { useMemo } from 'react';

interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isStaging: boolean;
  supabaseUrl: string;
  emailConfirmationRequired: boolean;
  autoConfirmInDevelopment: boolean;
}

export const useEnvironment = (): EnvironmentConfig => {
  return useMemo(() => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    const isDevelopment = hostname === 'localhost' || 
                         hostname.includes('lovableproject.com') || 
                         protocol === 'http:';
    
    const isStaging = hostname.includes('staging') || 
                     hostname.includes('preview') ||
                     hostname.includes('lovableproject.com');
    
    const isProduction = !isDevelopment && !isStaging;
    
    return {
      isDevelopment,
      isProduction,
      isStaging,
      supabaseUrl: 'https://ihnvrzwjxexdminrqivs.supabase.co',
      // In development, we can be more lenient with email confirmation
      emailConfirmationRequired: isProduction,
      // Auto-confirm users in development for easier testing
      autoConfirmInDevelopment: isDevelopment && false // Set to true to enable auto-confirm
    };
  }, []);
};

// Helper functions for common environment checks
export const isDevelopmentMode = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  return hostname === 'localhost' || 
         hostname.includes('lovableproject.com') || 
         protocol === 'http:';
};

export const getEnvironmentConfig = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  const isDev = hostname === 'localhost' || 
               hostname.includes('lovableproject.com') || 
               protocol === 'http:';
  
  return {
    development: isDev,
    staging: hostname.includes('staging') || hostname.includes('preview'),
    production: !isDev && !hostname.includes('staging')
  };
};