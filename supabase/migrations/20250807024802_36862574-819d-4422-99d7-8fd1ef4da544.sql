-- Continue fixing remaining functions with missing search paths

-- Fix check_rate_limit_with_logging function
CREATE OR REPLACE FUNCTION public.check_rate_limit_with_logging(_identifier text, _endpoint text, _max_attempts integer DEFAULT 10, _window_minutes integer DEFAULT 15, _ip_address inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_attempts integer;
  window_start_time timestamp with time zone;
BEGIN
  window_start_time := now() - (_window_minutes || ' minutes')::interval;
  
  -- Clean old attempts
  DELETE FROM public.rate_limit_attempts 
  WHERE created_at < window_start_time;
  
  -- Get current attempts in window
  SELECT COALESCE(SUM(attempt_count), 0) 
  INTO current_attempts
  FROM public.rate_limit_attempts 
  WHERE identifier = _identifier 
    AND endpoint = _endpoint 
    AND window_start >= window_start_time;
  
  -- Check if limit exceeded
  IF current_attempts >= _max_attempts THEN
    -- Log security event for rate limit exceeded
    INSERT INTO public.security_events (
      event_type,
      severity,
      details,
      ip_address,
      user_agent
    ) VALUES (
      'rate_limit_exceeded',
      'high',
      jsonb_build_object(
        'identifier', _identifier,
        'endpoint', _endpoint,
        'attempts', current_attempts,
        'max_allowed', _max_attempts,
        'window_minutes', _window_minutes,
        'blocked_at', now()
      ),
      _ip_address,
      _user_agent
    );
    
    RETURN false;
  END IF;
  
  -- Record this attempt
  INSERT INTO public.rate_limit_attempts (identifier, endpoint, window_start)
  VALUES (_identifier, _endpoint, now())
  ON CONFLICT (identifier, endpoint) 
  DO UPDATE SET 
    attempt_count = public.rate_limit_attempts.attempt_count + 1,
    created_at = now();
  
  RETURN true;
END;
$function$;

-- Fix detect_suspicious_activity function
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(_user_id uuid DEFAULT auth.uid(), _timeframe_hours integer DEFAULT 1)
RETURNS TABLE(event_type text, event_count bigint, severity text, last_occurrence timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    se.event_type,
    COUNT(*) as event_count,
    se.severity,
    MAX(se.created_at) as last_occurrence
  FROM public.security_events se
  WHERE (_user_id IS NULL OR se.user_id = _user_id)
    AND se.created_at >= now() - (_timeframe_hours || ' hours')::interval
    AND se.severity IN ('high', 'critical')
  GROUP BY se.event_type, se.severity
  ORDER BY event_count DESC, last_occurrence DESC;
$function$;

-- Fix generate_widget_id function
CREATE OR REPLACE FUNCTION public.generate_widget_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  RETURN 'widget_' || LOWER(REPLACE(gen_random_uuid()::text, '-', ''));
END;
$function$;