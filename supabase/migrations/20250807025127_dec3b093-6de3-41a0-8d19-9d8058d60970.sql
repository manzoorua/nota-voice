-- Fix the remaining functions with missing search paths

-- Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

-- Fix is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid, _role admin_role DEFAULT NULL::admin_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = _user_id
      AND is_active = true
      AND (CASE WHEN _role IS NULL THEN true ELSE role = _role END)
  )
$function$;

-- Fix log_security_event function
CREATE OR REPLACE FUNCTION public.log_security_event(_event_type text, _severity text DEFAULT 'medium'::text, _details jsonb DEFAULT '{}'::jsonb, _user_id uuid DEFAULT auth.uid(), _ip_address inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  event_id uuid;
BEGIN
  INSERT INTO public.security_events (
    event_type,
    severity,
    details,
    user_id,
    ip_address,
    user_agent
  ) VALUES (
    _event_type,
    _severity,
    _details,
    _user_id,
    _ip_address,
    _user_agent
  )
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$function$;