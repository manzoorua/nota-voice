-- Fix the final trigger functions and utilities

-- Fix update_bi_reports_updated_at function
CREATE OR REPLACE FUNCTION public.update_bi_reports_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_updated_at_clean function  
CREATE OR REPLACE FUNCTION public.update_updated_at_clean()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_updated_at_incidents function
CREATE OR REPLACE FUNCTION public.update_updated_at_incidents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_workflow_stats function
CREATE OR REPLACE FUNCTION public.update_workflow_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status IN ('success', 'error') THEN
    UPDATE public.n8n_workflows 
    SET 
      execution_count = execution_count + 1,
      last_executed_at = NEW.completed_at,
      avg_execution_time_ms = (
        SELECT COALESCE(AVG(execution_time_ms), 0)::integer 
        FROM public.n8n_executions 
        WHERE workflow_id = NEW.workflow_id 
        AND status = 'success'
        AND execution_time_ms IS NOT NULL
      ),
      success_rate = (
        SELECT CASE 
          WHEN COUNT(*) = 0 THEN 100.00
          ELSE (COUNT(*) FILTER (WHERE status = 'success') * 100.0 / COUNT(*))::numeric(5,2)
        END
        FROM public.n8n_executions 
        WHERE workflow_id = NEW.workflow_id
      ),
      updated_at = now()
    WHERE id = NEW.workflow_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix validate_api_key_encryption function
CREATE OR REPLACE FUNCTION public.validate_api_key_encryption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Ensure new API keys are encrypted (not plaintext)
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Check if the key looks like a plaintext key
    IF NEW.service_name = 'openai' AND NEW.encrypted_key LIKE 'sk-%' AND length(NEW.encrypted_key) < 100 THEN
      RAISE EXCEPTION 'API keys must be encrypted before storage. Use the secure-api-keys endpoint.';
    END IF;
    
    -- Log API key security events
    INSERT INTO public.security_events (
      event_type,
      severity,
      details,
      user_id
    ) VALUES (
      CASE WHEN TG_OP = 'INSERT' THEN 'api_key_created' ELSE 'api_key_updated' END,
      'medium',
      jsonb_build_object(
        'service_name', NEW.service_name,
        'key_name', NEW.key_name,
        'operation', TG_OP
      ),
      NEW.user_id
    );
    
    -- Also log to admin activity logs
    INSERT INTO public.admin_activity_logs (
      admin_user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      (SELECT id FROM public.admin_users WHERE user_id = NEW.user_id LIMIT 1),
      CASE WHEN TG_OP = 'INSERT' THEN 'api_key_created' ELSE 'api_key_updated' END,
      'api_key',
      NEW.id::text,
      jsonb_build_object(
        'service_name', NEW.service_name,
        'key_name', NEW.key_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;