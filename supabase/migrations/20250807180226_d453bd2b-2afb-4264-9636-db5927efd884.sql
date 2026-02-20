-- Create password reset logs table for detailed tracking
CREATE TABLE public.password_reset_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on password reset logs
ALTER TABLE public.password_reset_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for system to insert logs
CREATE POLICY "System can create password reset logs" 
ON public.password_reset_logs 
FOR INSERT 
WITH CHECK (true);

-- Create policy for admins to view logs
CREATE POLICY "Admins can view password reset logs" 
ON public.password_reset_logs 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Create rate limiting table for password reset emails
CREATE TABLE public.password_reset_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address INET,
  reset_attempts INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- Enable RLS on rate limits
ALTER TABLE public.password_reset_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy for system to manage rate limits
CREATE POLICY "System can manage password reset rate limits" 
ON public.password_reset_rate_limits 
FOR ALL 
USING (true);

-- Function to check and enforce password reset rate limits
CREATE OR REPLACE FUNCTION public.check_password_reset_rate_limit(
  user_email TEXT,
  user_ip INET DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_attempts INTEGER := 3;
  lockout_duration INTERVAL := '1 hour';
  current_attempts INTEGER := 0;
  last_attempt TIMESTAMP WITH TIME ZONE;
  locked_until_time TIMESTAMP WITH TIME ZONE;
  rate_limit_record RECORD;
BEGIN
  -- Get existing rate limit record
  SELECT * INTO rate_limit_record 
  FROM password_reset_rate_limits 
  WHERE email = user_email;
  
  IF rate_limit_record IS NULL THEN
    -- First attempt, create record
    INSERT INTO password_reset_rate_limits (email, ip_address)
    VALUES (user_email, user_ip);
    
    RETURN jsonb_build_object(
      'allowed', true,
      'attempts_remaining', max_attempts - 1,
      'reset_at', NULL
    );
  END IF;
  
  -- Check if currently locked
  IF rate_limit_record.locked_until IS NOT NULL 
     AND rate_limit_record.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'locked_until', rate_limit_record.locked_until,
      'attempts_remaining', 0
    );
  END IF;
  
  -- Check if we need to reset the counter (more than 1 hour since last attempt)
  IF rate_limit_record.last_attempt_at < NOW() - INTERVAL '1 hour' THEN
    -- Reset the attempts
    UPDATE password_reset_rate_limits 
    SET reset_attempts = 1,
        last_attempt_at = NOW(),
        locked_until = NULL
    WHERE email = user_email;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'attempts_remaining', max_attempts - 1,
      'reset_at', NOW()
    );
  END IF;
  
  -- Increment attempts
  current_attempts := rate_limit_record.reset_attempts + 1;
  
  IF current_attempts >= max_attempts THEN
    -- Lock the account
    locked_until_time := NOW() + lockout_duration;
    
    UPDATE password_reset_rate_limits 
    SET reset_attempts = current_attempts,
        last_attempt_at = NOW(),
        locked_until = locked_until_time
    WHERE email = user_email;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'locked_until', locked_until_time,
      'attempts_remaining', 0
    );
  ELSE
    -- Update attempts but don't lock
    UPDATE password_reset_rate_limits 
    SET reset_attempts = current_attempts,
        last_attempt_at = NOW()
    WHERE email = user_email;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'attempts_remaining', max_attempts - current_attempts,
      'reset_at', NULL
    );
  END IF;
END;
$$;

-- Function to log password reset attempts
CREATE OR REPLACE FUNCTION public.log_password_reset_attempt(
  user_email TEXT,
  user_ip INET DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  is_success BOOLEAN DEFAULT false,
  error_code TEXT DEFAULT NULL,
  error_message TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO password_reset_logs (
    email,
    ip_address,
    user_agent,
    success,
    error_code,
    error_message
  ) VALUES (
    user_email,
    user_ip,
    user_agent,
    is_success,
    error_code,
    error_message
  )
  RETURNING id INTO log_id;
  
  -- Also log as security event if it's a failure
  IF NOT is_success THEN
    PERFORM log_security_event(
      'password_reset_failed',
      'medium',
      jsonb_build_object(
        'email', user_email,
        'error_code', error_code,
        'error_message', error_message,
        'log_id', log_id
      ),
      NULL,
      user_ip,
      user_agent
    );
  END IF;
  
  RETURN log_id;
END;
$$;