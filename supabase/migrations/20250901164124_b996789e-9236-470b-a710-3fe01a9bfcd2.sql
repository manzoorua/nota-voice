-- Phase 1b: User Labels Table Creation
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

-- Enable RLS and create policy
ALTER TABLE public.user_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own labels" ON public.user_labels
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_user_labels_user_id ON public.user_labels(user_id);
CREATE INDEX idx_user_labels_usage ON public.user_labels(usage_count DESC);

-- Create trigger functions with proper search path
CREATE OR REPLACE FUNCTION public.update_ai_results_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_labels_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for timestamp updates
CREATE TRIGGER update_ai_results_updated_at
  BEFORE UPDATE ON public.ai_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_results_updated_at();

CREATE TRIGGER update_user_labels_updated_at
  BEFORE UPDATE ON public.user_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_labels_updated_at();