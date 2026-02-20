-- Fix security warnings by adding SET search_path to functions
CREATE OR REPLACE FUNCTION public.trigger_webhook_for_event(
  event_type_param TEXT,
  payload_param JSONB,
  user_id_param UUID DEFAULT NULL
)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- Fix trigger function for voice notes
CREATE OR REPLACE FUNCTION public.trigger_voice_note_webhooks()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- Fix trigger function for subscriptions
CREATE OR REPLACE FUNCTION public.trigger_subscription_webhooks()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- Fix trigger function for conversations
CREATE OR REPLACE FUNCTION public.trigger_conversation_webhooks()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;