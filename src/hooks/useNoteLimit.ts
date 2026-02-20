import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Safe auth hook for public routes
const useSafeAuth = () => {
  try {
    return useAuth();
  } catch (error) {
    // Return default state for public routes
    return {
      user: null,
      isPremium: false,
      isAdmin: false
    };
  }
};

interface NoteLimitInfo {
  currentCount: number;
  limit: number;
  remaining: number;
  canCreateNote: boolean;
  loading: boolean;
}

export const useNoteLimit = (): NoteLimitInfo => {
  const { user } = useSafeAuth();
  const [limitInfo, setLimitInfo] = useState<NoteLimitInfo>({
    currentCount: 0,
    limit: 5,
    remaining: 5,
    canCreateNote: true,
    loading: true
  });

  useEffect(() => {
    if (!user) {
      setLimitInfo(prev => ({ ...prev, loading: false, canCreateNote: false }));
      return;
    }

    const fetchNoteCount = async () => {
      try {
        const { count, error } = await supabase
          .from('voice_notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching note count:', error);
          return;
        }

        const currentCount = count || 0;
        const remaining = Math.max(0, 5 - currentCount);

        setLimitInfo({
          currentCount,
          limit: 5,
          remaining,
          canCreateNote: currentCount < 5,
          loading: false
        });
      } catch (error) {
        console.error('Error in fetchNoteCount:', error);
        setLimitInfo(prev => ({ ...prev, loading: false }));
      }
    };

    fetchNoteCount();

    // Set up real-time subscription to track note changes
    const subscription = supabase
      .channel('note-limit-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_notes',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNoteCount();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  return limitInfo;
};