import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SecureStorageHook {
  storeCredential: (name: string, value: string) => Promise<boolean>;
  retrieveCredential: (name: string) => Promise<string | null>;
  loading: boolean;
  error: string | null;
}

// Hook for secure credential storage and retrieval
export const useSecureStorage = (): SecureStorageHook => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeCredential = useCallback(async (name: string, value: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // Validate inputs
      if (!name || !value) {
        throw new Error('Credential name and value are required');
      }

      if (name.length > 100 || value.length > 10000) {
        throw new Error('Credential name or value too long');
      }

      // Call secure storage function
      const { data, error } = await supabase.rpc('store_encrypted_credential', {
        _credential_name: name,
        _credential_value: value
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast.success('Credential stored securely');
        return true;
      } else {
        throw new Error(result?.error || 'Failed to store credential');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to store credential';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Secure storage error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const retrieveCredential = useCallback(async (name: string): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);

      if (!name) {
        throw new Error('Credential name is required');
      }

      // Call secure retrieval function
      const { data, error } = await supabase.rpc('retrieve_encrypted_credential', {
        _credential_name: name
      });

      if (error) throw error;

      return data || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retrieve credential';
      setError(errorMessage);
      console.error('Secure retrieval error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    storeCredential,
    retrieveCredential,
    loading,
    error
  };
};

// Helper function to check if a credential exists
export const useCredentialCheck = () => {
  const checkCredentialExists = useCallback(async (name: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('encrypted_credentials')
        .select('id')
        .eq('credential_name', name)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      
      return !!data;
    } catch (err) {
      console.error('Error checking credential:', err);
      return false;
    }
  }, []);

  return { checkCredentialExists };
};