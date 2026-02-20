import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UserSettings {
  id?: string;
  user_id: string;
  output_language: string;
  default_ai_style: string;
  dark_mode_preference: boolean;
  auto_transcribe: boolean;
  auto_enhance: boolean;
  created_at?: string;
  updated_at?: string;
}

export const useUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      } else {
        // Create default settings
        const defaultSettings = {
          user_id: user.id,
          output_language: 'en',
          default_ai_style: 'clean',
          dark_mode_preference: false,
          auto_transcribe: true,
          auto_enhance: true,
        };

        const { data: newSettings, error: createError } = await (supabase as any)
          .from('user_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (createError) throw createError;
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user || !settings) return;

    try {
      const { data, error } = await (supabase as any)
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      setSettings(data);
      return data;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  return {
    settings,
    loading,
    updateSettings,
    refetch: fetchSettings,
  };
};