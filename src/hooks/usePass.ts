import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PassStatus {
  active: boolean;
  expiresAt?: string | null;
  loading: boolean;
}

export const usePass = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<PassStatus>({ active: false, expiresAt: null, loading: true });

  const check = useCallback(async () => {
    if (!user) {
      setStatus({ active: false, expiresAt: null, loading: false });
      return;
    }
    try {
      setStatus((s) => ({ ...s, loading: true }));
      const { data, error } = await supabase.rpc('check_pass_active');
      if (error) throw error;
      const anyData = data as any;
      const active = typeof anyData?.active === 'boolean' ? anyData.active : false;
      const expiresAt = anyData?.expires_at ?? null;
      setStatus({ active, expiresAt, loading: false });
    } catch (e) {
      console.error('check_pass_active error', e);
      setStatus({ active: false, expiresAt: null, loading: false });
    }
  }, [user]);

  useEffect(() => {
    check();
  }, [check]);

  return { ...status, refresh: check };
};
