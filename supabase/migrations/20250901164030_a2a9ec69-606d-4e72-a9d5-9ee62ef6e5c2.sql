-- Phase 1: Database Foundation for AI Tagging System

-- Create ai_results table for persistent AI result storage
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

-- Enable RLS for ai_results
ALTER TABLE public.ai_results ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own AI results
CREATE POLICY "Users can manage own AI results" ON public.ai_results
  FOR ALL USING (auth.uid() = user_id);

-- Performance indexes for ai_results
CREATE INDEX idx_ai_results_user_id ON public.ai_results(user_id);
CREATE INDEX idx_ai_results_created_at ON public.ai_results(created_at DESC);
CREATE INDEX idx_ai_results_labels ON public.ai_results USING GIN(labels);
CREATE INDEX idx_ai_results_type_user ON public.ai_results(result_type, user_id);

-- Create user_labels table for custom label management
CREATE TABLE public.user_labels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  label_name text NOT NULL,
  color_hex text DEFAULT '#6b7280',
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, label_name)
);

-- Enable RLS for user_labels
ALTER TABLE public.user_labels ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own labels
CREATE POLICY "Users can manage own labels" ON public.user_labels
  FOR ALL USING (auth.uid() = user_id);

-- Performance indexes for user_labels
CREATE INDEX idx_user_labels_user_id ON public.user_labels(user_id);
CREATE INDEX idx_user_labels_usage ON public.user_labels(usage_count DESC);

-- Create trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_ai_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_user_labels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for timestamp updates
CREATE TRIGGER update_ai_results_updated_at
  BEFORE UPDATE ON public.ai_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_results_updated_at();

CREATE TRIGGER update_user_labels_updated_at
  BEFORE UPDATE ON public.user_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_labels_updated_at();