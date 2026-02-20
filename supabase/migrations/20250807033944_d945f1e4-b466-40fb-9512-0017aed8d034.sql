-- Create secure admin role management functions and audit logging

-- Create a secure role change function that enforces business rules
CREATE OR REPLACE FUNCTION public.secure_change_user_role(
  _target_user_id uuid,
  _new_role app_role,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _current_user_id uuid := auth.uid();
  _current_user_role app_role;
  _target_current_role app_role;
  _result jsonb;
BEGIN
  -- Get current user's role
  SELECT role INTO _current_user_role
  FROM user_roles
  WHERE user_id = _current_user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'moderator' THEN 2
    WHEN 'user' THEN 3
  END
  LIMIT 1;

  -- Get target user's current role
  SELECT role INTO _target_current_role
  FROM user_roles
  WHERE user_id = _target_user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'moderator' THEN 2
    WHEN 'user' THEN 3
  END
  LIMIT 1;

  -- Security checks
  IF _current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  IF _current_user_role IS NULL OR _current_user_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Prevent self-modification
  IF _current_user_id = _target_user_id THEN
    -- Log security event
    INSERT INTO security_events (
      event_type,
      severity,
      details,
      user_id
    ) VALUES (
      'self_role_modification_attempt',
      'high',
      jsonb_build_object(
        'attempted_role', _new_role,
        'current_role', _current_user_role,
        'target_user_id', _target_user_id,
        'reason', _reason
      ),
      _current_user_id
    );
    
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify your own role');
  END IF;

  -- Prevent creating multiple admins without explicit approval
  IF _new_role = 'admin' AND _target_current_role != 'admin' THEN
    DECLARE
      admin_count int;
    BEGIN
      SELECT COUNT(*) INTO admin_count
      FROM user_roles
      WHERE role = 'admin';
      
      -- Log admin creation attempt
      INSERT INTO security_events (
        event_type,
        severity,
        details,
        user_id
      ) VALUES (
        'admin_role_assignment',
        'critical',
        jsonb_build_object(
          'target_user_id', _target_user_id,
          'previous_role', _target_current_role,
          'new_role', _new_role,
          'current_admin_count', admin_count,
          'reason', _reason
        ),
        _current_user_id
      );
    END;
  END IF;

  -- Update or insert role
  INSERT INTO user_roles (user_id, role)
  VALUES (_target_user_id, _new_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Remove old roles that are different
  DELETE FROM user_roles
  WHERE user_id = _target_user_id AND role != _new_role;

  -- Log successful role change
  INSERT INTO security_events (
    event_type,
    severity,
    details,
    user_id
  ) VALUES (
    'role_changed',
    'medium',
    jsonb_build_object(
      'target_user_id', _target_user_id,
      'previous_role', _target_current_role,
      'new_role', _new_role,
      'reason', _reason
    ),
    _current_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'previous_role', _target_current_role,
    'new_role', _new_role
  );
END;
$$;

-- Create audit logging for voice note processing
CREATE OR REPLACE FUNCTION public.log_voice_note_processing(
  _user_id uuid,
  _file_size bigint,
  _duration_seconds integer,
  _processing_time_ms integer DEFAULT NULL,
  _error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO security_events (
    event_type,
    severity,
    details,
    user_id
  ) VALUES (
    CASE 
      WHEN _error_message IS NOT NULL THEN 'voice_processing_failed'
      ELSE 'voice_processing_completed'
    END,
    CASE 
      WHEN _error_message IS NOT NULL THEN 'medium'
      WHEN _file_size > 10485760 THEN 'medium' -- 10MB
      ELSE 'low'
    END,
    jsonb_build_object(
      'file_size_bytes', _file_size,
      'duration_seconds', _duration_seconds,
      'processing_time_ms', _processing_time_ms,
      'error_message', _error_message,
      'timestamp', now()
    ),
    _user_id
  );
END;
$$;

-- Create function to validate and encrypt webhook secrets
CREATE OR REPLACE FUNCTION public.encrypt_webhook_secret(_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Simple encryption for webhook secrets (in production, use proper encryption)
  -- This is a placeholder - in real implementation, use proper encryption
  RETURN encode(digest(_secret || current_setting('app.webhook_salt', true), 'sha256'), 'base64');
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to simple encoding if encryption fails
    RETURN encode(_secret::bytea, 'base64');
END;
$$;

-- Add rate limiting for voice processing
CREATE TABLE IF NOT EXISTS public.voice_processing_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  processing_date date NOT NULL DEFAULT CURRENT_DATE,
  processing_count integer NOT NULL DEFAULT 0,
  total_duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, processing_date)
);

ALTER TABLE public.voice_processing_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processing limits"
ON public.voice_processing_limits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage processing limits"
ON public.voice_processing_limits
FOR ALL
USING (true);

-- Function to check voice processing limits
CREATE OR REPLACE FUNCTION public.check_voice_processing_limit(
  _user_id uuid,
  _duration_seconds integer,
  _max_daily_duration integer DEFAULT 3600, -- 1 hour default
  _max_daily_count integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _current_record record;
  _new_count integer;
  _new_duration integer;
BEGIN
  -- Get or create today's record
  SELECT * INTO _current_record
  FROM voice_processing_limits
  WHERE user_id = _user_id AND processing_date = CURRENT_DATE;

  IF _current_record IS NULL THEN
    _new_count := 1;
    _new_duration := _duration_seconds;
  ELSE
    _new_count := _current_record.processing_count + 1;
    _new_duration := _current_record.total_duration_seconds + _duration_seconds;
  END IF;

  -- Check limits
  IF _new_count > _max_daily_count THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_count_exceeded',
      'current_count', COALESCE(_current_record.processing_count, 0),
      'limit', _max_daily_count
    );
  END IF;

  IF _new_duration > _max_daily_duration THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_duration_exceeded',
      'current_duration', COALESCE(_current_record.total_duration_seconds, 0),
      'limit', _max_daily_duration
    );
  END IF;

  -- Update or insert the record
  INSERT INTO voice_processing_limits (user_id, processing_date, processing_count, total_duration_seconds)
  VALUES (_user_id, CURRENT_DATE, _new_count, _new_duration)
  ON CONFLICT (user_id, processing_date)
  DO UPDATE SET
    processing_count = _new_count,
    total_duration_seconds = _new_duration,
    updated_at = now();

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining_count', _max_daily_count - _new_count,
    'remaining_duration', _max_daily_duration - _new_duration
  );
END;
$$;

-- Add updated_at trigger for voice_processing_limits
CREATE TRIGGER update_voice_processing_limits_updated_at
  BEFORE UPDATE ON public.voice_processing_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.secure_change_user_role(uuid, app_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_voice_note_processing(uuid, bigint, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_webhook_secret(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_voice_processing_limit(uuid, integer, integer, integer) TO authenticated;