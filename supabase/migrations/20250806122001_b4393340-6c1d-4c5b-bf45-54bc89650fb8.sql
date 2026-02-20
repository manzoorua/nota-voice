-- Add missing RLS policies for webhooks table
CREATE POLICY IF NOT EXISTS "Users can manage their own webhooks" 
ON public.webhooks 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add missing RLS policies for webhook_logs table
CREATE POLICY IF NOT EXISTS "Users can view logs for their webhooks" 
ON public.webhook_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.webhooks 
  WHERE webhooks.id = webhook_logs.webhook_id 
  AND webhooks.user_id = auth.uid()
));

CREATE POLICY IF NOT EXISTS "System can create webhook logs" 
ON public.webhook_logs 
FOR INSERT 
WITH CHECK (true);

-- Add missing RLS policies for webhook_events table
CREATE POLICY IF NOT EXISTS "Anyone can view webhook events" 
ON public.webhook_events 
FOR SELECT 
USING (is_active = true);

-- Create function to trigger webhooks from application events
CREATE OR REPLACE FUNCTION public.trigger_webhook_for_event(
  event_type_param TEXT,
  payload_param JSONB,
  user_id_param UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Call the trigger-webhooks edge function directly via HTTP
  PERFORM net.http_post(
    url := 'https://ihnvrzwjxexdminrqivs.supabase.co/functions/v1/trigger-webhooks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'eventType', event_type_param,
      'payload', payload_param,
      'userId', user_id_param
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main transaction
  RAISE LOG 'Failed to trigger webhook for event %: %', event_type_param, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function for voice notes
CREATE OR REPLACE FUNCTION public.trigger_voice_note_webhooks()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for voice notes if it doesn't exist
DROP TRIGGER IF EXISTS voice_note_webhook_trigger ON public.voice_notes;
CREATE TRIGGER voice_note_webhook_trigger
AFTER INSERT OR UPDATE ON public.voice_notes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_voice_note_webhooks();

-- Create trigger function for user registration
CREATE OR REPLACE FUNCTION public.trigger_user_registration_webhook()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.trigger_webhook_for_event(
    'user_registered',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'created_at', NEW.created_at
    ),
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for subscription events
CREATE OR REPLACE FUNCTION public.trigger_subscription_webhooks()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for subscriptions
DROP TRIGGER IF EXISTS subscription_webhook_trigger ON public.subscriptions;
CREATE TRIGGER subscription_webhook_trigger
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_subscription_webhooks();

-- Create trigger function for conversations
CREATE OR REPLACE FUNCTION public.trigger_conversation_webhooks()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for conversations
DROP TRIGGER IF EXISTS conversation_webhook_trigger ON public.conversations;
CREATE TRIGGER conversation_webhook_trigger
AFTER INSERT ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.trigger_conversation_webhooks();