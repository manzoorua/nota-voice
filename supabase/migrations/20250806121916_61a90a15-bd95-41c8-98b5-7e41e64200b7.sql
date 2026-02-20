-- Create voice_notes table for storing voice recordings and transcriptions
CREATE TABLE public.voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  original_audio_url TEXT,
  transcription TEXT,
  enhanced_content TEXT,
  duration_seconds INTEGER,
  file_size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'processing',
  processing_error TEXT,
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for voice_notes
CREATE POLICY "Users can view their own voice notes" 
ON public.voice_notes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own voice notes" 
ON public.voice_notes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice notes" 
ON public.voice_notes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice notes" 
ON public.voice_notes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create webhooks table (if not exists)
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  headers JSONB DEFAULT '{}',
  events TEXT[] NOT NULL DEFAULT '{}',
  auth_type TEXT,
  auth_config JSONB DEFAULT '{}',
  secret_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  retry_count INTEGER NOT NULL DEFAULT 3,
  timeout_seconds INTEGER NOT NULL DEFAULT 30,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for webhooks if not already enabled
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- Create webhook_logs table (if not exists)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  error_message TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create webhook_events table for available event types
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL UNIQUE,
  event_name TEXT NOT NULL,
  description TEXT,
  sample_payload JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default webhook events
INSERT INTO public.webhook_events (event_type, event_name, description, sample_payload) VALUES
('voice_note_created', 'Voice Note Created', 'Triggered when a new voice note is created', '{"id": "uuid", "title": "string", "user_id": "uuid", "created_at": "timestamp"}'),
('voice_note_processed', 'Voice Note Processed', 'Triggered when voice note processing is completed', '{"id": "uuid", "title": "string", "transcription": "string", "enhanced_content": "string", "status": "completed"}'),
('user_registered', 'User Registered', 'Triggered when a new user signs up', '{"user_id": "uuid", "email": "string", "created_at": "timestamp"}'),
('subscription_created', 'Subscription Created', 'Triggered when a user subscribes', '{"user_id": "uuid", "plan_name": "string", "status": "active"}'),
('subscription_updated', 'Subscription Updated', 'Triggered when subscription status changes', '{"user_id": "uuid", "old_status": "string", "new_status": "string"}'),
('conversation_started', 'Conversation Started', 'Triggered when a new chatbot conversation begins', '{"conversation_id": "uuid", "chatbot_id": "uuid", "user_id": "uuid"}')
ON CONFLICT (event_type) DO NOTHING;

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_voice_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for voice_notes
CREATE TRIGGER update_voice_notes_updated_at
BEFORE UPDATE ON public.voice_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_voice_notes_updated_at();

-- Create function to trigger webhooks for voice note events
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

  -- Trigger webhooks asynchronously using pg_notify
  PERFORM pg_notify('webhook_trigger', jsonb_build_object(
    'event_type', event_type_name,
    'payload', payload,
    'user_id', NEW.user_id
  )::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for voice note webhook events
CREATE TRIGGER voice_note_webhook_trigger
AFTER INSERT OR UPDATE ON public.voice_notes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_voice_note_webhooks();