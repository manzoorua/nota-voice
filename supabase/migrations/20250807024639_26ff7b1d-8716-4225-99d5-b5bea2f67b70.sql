-- Fix remaining functions with mutable search paths

-- Fix trigger_conversation_webhooks function
CREATE OR REPLACE FUNCTION public.trigger_conversation_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.trigger_webhook_for_event(
      'conversation_started',
      jsonb_build_object(
        'conversation_id', NEW.id,
        'chatbot_id', NEW.chatbot_id,
        'user_id', NEW.user_id,
        'created_at', NEW.created_at
      ),
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix trigger_voice_note_webhooks function
CREATE OR REPLACE FUNCTION public.trigger_voice_note_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  event_type_name TEXT;
  payload JSONB;
BEGIN
  -- Determine event type based on operation
  IF TG_OP = 'INSERT' THEN
    event_type_name := 'voice_note_created';
    payload := jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'status', NEW.status,
      'created_at', NEW.created_at
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'completed' THEN
    event_type_name := 'voice_note_processed';
    payload := jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'transcription', NEW.transcription,
      'enhanced_content', NEW.enhanced_content,
      'status', NEW.status,
      'updated_at', NEW.updated_at
    );
  ELSE
    RETURN NEW;
  END IF;

  -- Trigger webhooks
  PERFORM public.trigger_webhook_for_event(event_type_name, payload, NEW.user_id);

  RETURN NEW;
END;
$function$;

-- Fix trigger_subscription_webhooks function
CREATE OR REPLACE FUNCTION public.trigger_subscription_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  event_type_name TEXT;
  payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_type_name := 'subscription_created';
    payload := jsonb_build_object(
      'user_id', NEW.user_id,
      'plan_name', NEW.plan_name,
      'status', NEW.status,
      'created_at', NEW.created_at
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    event_type_name := 'subscription_updated';
    payload := jsonb_build_object(
      'user_id', NEW.user_id,
      'plan_name', NEW.plan_name,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'updated_at', NEW.updated_at
    );
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.trigger_webhook_for_event(event_type_name, payload, NEW.user_id);
  RETURN NEW;
END;
$function$;