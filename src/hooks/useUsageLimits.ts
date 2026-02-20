import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface UsageLimits {
  notesUsed: number;
  notesLimit: number;
  processingTimeUsed: number;
  processingTimeLimit: number;
  canCreateNote: boolean;
  loading: boolean;
}

export const useUsageLimits = (): UsageLimits => {
  const { user, isPremium, isAdmin } = useAuth();
  const [limits, setLimits] = useState<UsageLimits>({
    notesUsed: 0,
    notesLimit: 10, // Free tier default
    processingTimeUsed: 0,
    processingTimeLimit: 180, // 3 minutes for free tier
    canCreateNote: true,
    loading: true
  });

  useEffect(() => {
    if (!user) {
      setLimits(prev => ({ ...prev, loading: false, canCreateNote: false }));
      return;
    }

    // Set limits based on user tier
    const notesLimit = isPremium || isAdmin ? 1000 : 10;
    const processingTimeLimit = isPremium || isAdmin ? 900 : 180; // 15 minutes vs 3 minutes

    // For now, we'll use simple client-side tracking
    // In production, this would come from the database
    const savedUsage = localStorage.getItem(`usage_${user.id}`);
    const usage = savedUsage ? JSON.parse(savedUsage) : { notes: 0, time: 0 };

    // Reset usage daily for demo purposes
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem(`usage_reset_${user.id}`);
    
    if (lastReset !== today) {
      usage.notes = 0;
      usage.time = 0;
      localStorage.setItem(`usage_${user.id}`, JSON.stringify(usage));
      localStorage.setItem(`usage_reset_${user.id}`, today);
    }

    setLimits({
      notesUsed: usage.notes,
      notesLimit,
      processingTimeUsed: usage.time,
      processingTimeLimit,
      canCreateNote: usage.notes < notesLimit,
      loading: false
    });
  }, [user, isPremium, isAdmin]);

  return limits;
};