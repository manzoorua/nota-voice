-- Fix the final remaining functions

-- Fix reset_failed_attempts function
CREATE OR REPLACE FUNCTION public.reset_failed_attempts(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.account_lockouts 
  SET failed_attempts = 0, 
      locked_until = NULL,
      updated_at = NOW()
  WHERE email = user_email;
END;
$function$;

-- Fix trigger_webhook_for_event function
CREATE OR REPLACE FUNCTION public.trigger_webhook_for_event(event_type_param text, payload_param jsonb, user_id_param uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  webhook_record RECORD;
BEGIN
  -- Get active webhooks for this event and user
  FOR webhook_record IN 
    SELECT id, url, method, headers, auth_type, auth_config, secret_key, retry_count, timeout_seconds
    FROM public.webhooks 
    WHERE is_active = true 
    AND event_type_param = ANY(events)
    AND (user_id_param IS NULL OR user_id = user_id_param)
  LOOP
    -- Log the webhook call attempt
    INSERT INTO public.webhook_logs (
      webhook_id, 
      event_type, 
      payload, 
      attempt_number, 
      success,
      created_at
    ) VALUES (
      webhook_record.id,
      event_type_param,
      payload_param,
      1,
      false,
      now()
    );
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main transaction
  RAISE LOG 'Failed to trigger webhook for event %: %', event_type_param, SQLERRM;
END;
$function$;