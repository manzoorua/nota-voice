-- Fix all remaining functions with missing search paths

-- Fix assign_default_role function
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;

-- Fix calculate_lead_quality_score function
CREATE OR REPLACE FUNCTION public.calculate_lead_quality_score(_engagement_time_seconds integer, _page_views integer, _form_completion_time_seconds integer, _message_count integer, _returning_visitor boolean, _traffic_source text, _device_type text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  score INTEGER := 0;
BEGIN
  -- Base engagement score (0-30 points)
  score := score + LEAST(30, _engagement_time_seconds / 10);
  
  -- Page views score (0-20 points)
  score := score + LEAST(20, _page_views * 5);
  
  -- Form completion speed score (0-15 points)
  -- Faster completion (within reasonable range) gets higher score
  IF _form_completion_time_seconds BETWEEN 30 AND 300 THEN
    score := score + 15;
  ELSIF _form_completion_time_seconds BETWEEN 301 AND 600 THEN
    score := score + 10;
  ELSIF _form_completion_time_seconds > 600 THEN
    score := score + 5;
  END IF;
  
  -- Message interaction score (0-15 points)
  score := score + LEAST(15, _message_count * 3);
  
  -- Returning visitor bonus (0-10 points)
  IF _returning_visitor THEN
    score := score + 10;
  END IF;
  
  -- Traffic source quality (0-10 points)
  CASE _traffic_source
    WHEN 'organic' THEN score := score + 10;
    WHEN 'referral' THEN score := score + 8;
    WHEN 'social' THEN score := score + 6;
    WHEN 'email' THEN score := score + 9;
    WHEN 'paid' THEN score := score + 5;
    ELSE score := score + 3;
  END CASE;
  
  -- Ensure score is between 0 and 100
  score := GREATEST(0, LEAST(100, score));
  
  RETURN score;
END;
$function$;

-- Fix check_rate_limit function
CREATE OR REPLACE FUNCTION public.check_rate_limit(_identifier text, _endpoint text, _max_attempts integer DEFAULT 10, _window_minutes integer DEFAULT 15)
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