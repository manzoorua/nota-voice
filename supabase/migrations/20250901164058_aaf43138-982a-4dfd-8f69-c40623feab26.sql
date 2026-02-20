-- Phase 1: AI Results Table Creation
CREATE TABLE public.ai_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  content text NOT NULL,
  result_type text NOT NULL CHECK (result_type IN ('summary', 'translation', 'enhancement')),
  original_text text NOT NULL,
  metadata jsonb DEFAULT '{}',
  processing_time_ms integer,
  labels text[] DEFAULT '{}',
  is_favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS and create policy
ALTER TABLE public.ai_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own AI results" ON public.ai_results
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_ai_results_user_id ON public.ai_results(user_id);
CREATE INDEX idx_ai_results_created_at ON public.ai_results(created_at DESC);
CREATE INDEX idx_ai_results_labels ON public.ai_results USING GIN(labels);