import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserLabel {
  id: string;
  label_name: string;
  color_hex: string;
  usage_count: number;
  created_at: string;
}

export const useUserLabels = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: labels = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['user-labels'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('manage-user-labels', {
        body: { action: 'list' },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  const createLabelMutation = useMutation({
    mutationFn: async ({ label_name, color_hex }: { label_name: string; color_hex?: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-user-labels', {
        body: { 
          action: 'create', 
          label_name, 
          color_hex 
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-labels'] });
    }
  });

  const updateLabelMutation = useMutation({
    mutationFn: async ({ 
      label_id, 
      label_name, 
      color_hex 
    }: { 
      label_id: string; 
      label_name?: string; 
      color_hex?: string 
    }) => {
      const { data, error } = await supabase.functions.invoke('manage-user-labels', {
        body: { 
          action: 'update', 
          label_id,
          label_name,
          color_hex
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-labels'] });
    }
  });

  const deleteLabelMutation = useMutation({
    mutationFn: async (label_id: string) => {
      const { data, error } = await supabase.functions.invoke('manage-user-labels', {
        body: { 
          action: 'delete',
          label_id
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-labels'] });
      queryClient.invalidateQueries({ queryKey: ['ai-results'] });
    }
  });

  // Predefined label suggestions
  const predefinedLabels = [
    { name: 'Work', color: '#3b82f6' },
    { name: 'Personal', color: '#10b981' },
    { name: 'Important', color: '#f59e0b' },
    { name: 'Research', color: '#8b5cf6' },
    { name: 'Meeting Notes', color: '#06b6d4' },
    { name: 'Ideas', color: '#f97316' },
    { name: 'Draft', color: '#6b7280' },
    { name: 'Review', color: '#ef4444' }
  ];

  return {
    labels,
    predefinedLabels,
    isLoading,
    error,
    refetch,
    createLabel: createLabelMutation.mutate,
    updateLabel: updateLabelMutation.mutate,
    deleteLabel: deleteLabelMutation.mutate,
    isCreateLoading: createLabelMutation.isPending,
    isUpdateLoading: updateLabelMutation.isPending,
    isDeleteLoading: deleteLabelMutation.isPending
  };
};