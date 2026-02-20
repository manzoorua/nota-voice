import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SubscriptionState {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string;
  loading: boolean;
}

export const useSubscription = () => {
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>({
    subscribed: false,
    loading: true,
  });
  const { user } = useAuth();

  const checkSubscription = async () => {
    if (!user) {
      setSubscriptionState({ subscribed: false, loading: false });
      return;
    }

    try {
      setSubscriptionState(prev => ({ ...prev, loading: true }));
      
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) throw error;

      setSubscriptionState({
        subscribed: data.subscribed || false,
        subscription_tier: data.subscription_tier,
        subscription_end: data.subscription_end,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscriptionState({ subscribed: false, loading: false });
    }
  };

  const refreshSubscription = () => {
    checkSubscription();
  };

  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      setSubscriptionState({ subscribed: false, loading: false });
    }
  }, [user]);

  // Auto-refresh subscription status every 10 seconds when page is visible
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkSubscription();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  return {
    ...subscriptionState,
    refreshSubscription,
    checkSubscription,
  };
};