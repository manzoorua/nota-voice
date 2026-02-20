import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AIResult {
  id: string;
  content: string;
  type: 'summary' | 'translation' | 'enhancement';
  metadata: {
    originalLength?: number;
    summaryLength?: number;
    enhancementType?: string;
    targetLanguage?: string;
    processingTime?: number;
    [key: string]: any;
  };
  timestamp: Date;
  labels: string[];
}

interface AIResultFilters {
  type?: string;
  search?: string;
  labels?: string[];
  is_favorite?: boolean;
  page?: number;
  limit?: number;
}

export const useAIResults = (filters: AIResultFilters = {}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: aiResultsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['ai-results', filters],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const params = new URLSearchParams();
      if (filters.type) params.append('result_type', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.labels && filters.labels.length > 0) {
        params.append('labels', filters.labels.join(','));
      }
      if (filters.is_favorite !== undefined) {
        params.append('is_favorite', filters.is_favorite.toString());
      }
      params.append('page', (filters.page || 1).toString());
      params.append('limit', (filters.limit || 20).toString());

      const { data, error } = await supabase.functions.invoke('get-ai-results', {
        body: {},
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      // Transform data to match AIResult interface
      const transformedResults: AIResult[] = (data.data || []).map((result: any) => ({
        id: result.id,
        content: result.content,
        type: result.result_type,
        metadata: result.metadata || {},
        timestamp: new Date(result.created_at),
        labels: result.labels || []
      }));

      return {
        results: transformedResults,
        pagination: data.pagination || {
          page: 1,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const { data, error } = await supabase
        .from('ai_results')
        .update({ is_favorite })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-results'] });
    }
  });

  const updateLabelsMutation = useMutation({
    mutationFn: async ({ id, labels }: { id: string; labels: string[] }) => {
      const { data, error } = await supabase
        .from('ai_results')
        .update({ labels })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-results'] });
      queryClient.invalidateQueries({ queryKey: ['user-labels'] });
    }
  });

  const deleteResultMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_results')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-results'] });
    }
  });

  return {
    aiResults: aiResultsData?.results || [],
    pagination: aiResultsData?.pagination,
    isLoading,
    error,
    refetch,
    toggleFavorite: toggleFavoriteMutation.mutate,
    updateLabels: updateLabelsMutation.mutate,
    deleteResult: deleteResultMutation.mutate,
    isToggleFavoriteLoading: toggleFavoriteMutation.isPending,
    isUpdateLabelsLoading: updateLabelsMutation.isPending,
    isDeleteLoading: deleteResultMutation.isPending
  };
};