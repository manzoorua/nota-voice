-- Fix the final batch of functions with missing search paths

-- Fix handle_failed_login function
CREATE OR REPLACE FUNCTION public.handle_failed_login(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  max_attempts INTEGER := 5;
  lockout_duration INTERVAL := '15 minutes';
  current_lockout RECORD;
BEGIN
  -- Get or create lockout record
  SELECT * INTO current_lockout 
  FROM public.account_lockouts 
  WHERE email = user_email;
  
  IF current_lockout IS NULL THEN
    -- Create new lockout record
    INSERT INTO public.account_lockouts (email, failed_attempts)
    VALUES (user_email, 1);
  ELSE
    -- Update existing record
    IF current_lockout.locked_until IS NULL OR current_lockout.locked_until < NOW() THEN
      -- Not currently locked or lock expired
      UPDATE public.account_lockouts 
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE 
            WHEN failed_attempts + 1 >= max_attempts 
            THEN NOW() + lockout_duration 
            ELSE NULL 
          END,
          updated_at = NOW()
      WHERE email = user_email;
    END IF;
  END IF;
END;
$function$;

-- Fix handle_new_user function  
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'last_name');
  RETURN NEW;
END;
$function$;

-- Fix handle_new_user_clean_v2 function
CREATE OR REPLACE FUNCTION public.handle_new_user_clean_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.clean_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  
  -- Create default subscription
  INSERT INTO public.clean_subscriptions (
    user_id,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    NOW(),
    NOW() + INTERVAL '1 month'
  );
  
  RETURN NEW;
END;
$function$;