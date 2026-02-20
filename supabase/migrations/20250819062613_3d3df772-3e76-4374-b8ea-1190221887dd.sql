-- Enhance voice_notes table for N8N processing tracking
ALTER TABLE public.voice_notes 
ADD COLUMN IF NOT EXISTS processing_method text DEFAULT 'edge_functions',
ADD COLUMN IF NOT EXISTS n8n_workflow_id text,
ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
ADD COLUMN IF NOT EXISTS processing_steps jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS fallback_reason text;

-- Add constraint for processing_method
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'voice_notes_processing_method_check'
    ) THEN
        ALTER TABLE public.voice_notes 
        ADD CONSTRAINT voice_notes_processing_method_check 
        CHECK (processing_method IN ('edge_functions', 'n8n', 'hybrid'));
    END IF;
END $$;

-- Enhance system_configuration for better N8N workflow management
ALTER TABLE public.system_configuration 
ADD COLUMN IF NOT EXISTS n8n_voice_upload_endpoint text,
ADD COLUMN IF NOT EXISTS n8n_transcribe_endpoint text,
ADD COLUMN IF NOT EXISTS n8n_enhance_endpoint text,
ADD COLUMN IF NOT EXISTS n8n_health_check_endpoint text,
ADD COLUMN IF NOT EXISTS n8n_webhook_secret text,
ADD COLUMN IF NOT EXISTS processing_timeout_seconds integer DEFAULT 300,
ADD COLUMN IF NOT EXISTS max_file_size_n8n_mb integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS n8n_retry_attempts integer DEFAULT 2;

-- Drop existing function and recreate with N8N consideration
DROP FUNCTION IF EXISTS public.check_voice_processing_limit(uuid, integer);

CREATE OR REPLACE FUNCTION public.check_voice_processing_limit(
  _user_id uuid,
  _duration_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today date := CURRENT_DATE;
  user_limits record;
  usage_today record;
  max_notes integer;
  max_duration integer;
  result jsonb;
BEGIN
  -- Get user subscription limits
  SELECT 
    COALESCE(us.max_monthly_notes_premium, sc.max_monthly_notes_premium, 1000) as premium_notes,
    COALESCE(sc.max_monthly_notes_free, 10) as free_notes,
    COALESCE(sc.max_audio_duration_seconds, 300) as max_audio_duration
  INTO user_limits
  FROM system_configuration sc
  LEFT JOIN user_passes us ON us.user_id = _user_id AND us.expires_at > now() AND us.status = 'active'
  ORDER BY sc.created_at DESC
  LIMIT 1;
  
  -- Check if user has active pass
  IF EXISTS(SELECT 1 FROM user_passes WHERE user_id = _user_id AND expires_at > now() AND status = 'active') THEN
    max_notes := user_limits.premium_notes;
  ELSE
    max_notes := user_limits.free_notes;
  END IF;
  
  max_duration := user_limits.max_audio_duration;
  
  -- Get today's usage
  SELECT 
    COALESCE(processing_count, 0) as count,
    COALESCE(total_duration_seconds, 0) as duration
  INTO usage_today
  FROM voice_processing_limits 
  WHERE user_id = _user_id AND processing_date = today;
  
  -- Check limits
  IF usage_today.count >= max_notes THEN
    result := jsonb_build_object(
      'allowed', false,
      'reason', 'Daily note limit exceeded',
      'remaining_count', 0,
      'remaining_duration', GREATEST(0, max_duration - usage_today.duration)
    );
  ELSIF _duration_seconds > max_duration THEN
    result := jsonb_build_object(
      'allowed', false,
      'reason', 'Audio duration exceeds maximum allowed',
      'remaining_count', max_notes - usage_today.count,
      'remaining_duration', GREATEST(0, max_duration - usage_today.duration)
    );
  ELSE
    result := jsonb_build_object(
      'allowed', true,
      'reason', 'Within limits',
      'remaining_count', max_notes - usage_today.count - 1,
      'remaining_duration', GREATEST(0, max_duration - usage_today.duration - _duration_seconds)
    );
  END IF;
  
  RETURN result;
END;
$$;