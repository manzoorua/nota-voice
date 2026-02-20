-- Create webhooks table for managing webhook configurations
CREATE TABLE public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  headers JSONB DEFAULT '{}',
  auth_type TEXT DEFAULT 'none', -- none, api_key, bearer, basic
  auth_config JSONB DEFAULT '{}',
  events TEXT[] DEFAULT '{}', -- array of event types this webhook subscribes to
  is_active BOOLEAN NOT NULL DEFAULT true,
  retry_count INTEGER NOT NULL DEFAULT 3,
  timeout_seconds INTEGER NOT NULL DEFAULT 30,
  secret_key TEXT, -- for webhook signature verification
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create webhook_logs table for tracking webhook calls
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
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

-- Create webhook_events table for defining available webhook events
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sample_payload JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create integrations table for managing third-party integrations
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  integration_type TEXT NOT NULL, -- zapier, n8n, custom, slack, discord, etc.
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  credentials JSONB DEFAULT '{}', -- encrypted credentials
  webhook_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending', -- pending, success, error
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for webhooks
CREATE POLICY "Users can manage their own webhooks" ON public.webhooks
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for webhook_logs
CREATE POLICY "Users can view logs from their webhooks" ON public.webhook_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.webhooks
      WHERE webhooks.id = webhook_logs.webhook_id
      AND webhooks.user_id = auth.uid()
    )
  );

CREATE POLICY "System can create webhook logs" ON public.webhook_logs
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for webhook_events
CREATE POLICY "Everyone can view webhook events" ON public.webhook_events
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage webhook events" ON public.webhook_events
  FOR ALL USING (is_admin(auth.uid()));

-- Create RLS policies for integrations
CREATE POLICY "Users can manage their own integrations" ON public.integrations
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_webhooks_user_id ON public.webhooks(user_id);
CREATE INDEX idx_webhooks_active ON public.webhooks(is_active);
CREATE INDEX idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at);
CREATE INDEX idx_integrations_user_id ON public.integrations(user_id);
CREATE INDEX idx_integrations_type ON public.integrations(integration_type);

-- Create updated_at trigger for webhooks
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for integrations
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default webhook events
INSERT INTO public.webhook_events (event_type, name, description, sample_payload) VALUES
('voice_note.created', 'Voice Note Created', 'Triggered when a new voice note is created', '{"id": "uuid", "title": "string", "content": "string", "user_id": "uuid", "created_at": "timestamp"}'),
('voice_note.processed', 'Voice Note Processed', 'Triggered when a voice note is fully processed by AI', '{"id": "uuid", "title": "string", "content": "string", "processing_time": "number", "user_id": "uuid"}'),
('subscription.created', 'Subscription Created', 'Triggered when a user creates a subscription', '{"user_id": "uuid", "plan": "string", "status": "string", "created_at": "timestamp"}'),
('subscription.updated', 'Subscription Updated', 'Triggered when a subscription is updated', '{"user_id": "uuid", "plan": "string", "status": "string", "updated_at": "timestamp"}'),
('user.registered', 'User Registered', 'Triggered when a new user registers', '{"user_id": "uuid", "email": "string", "created_at": "timestamp"}'),
('chatbot.message', 'Chatbot Message', 'Triggered when a chatbot receives or sends a message', '{"chatbot_id": "uuid", "message": "string", "role": "string", "conversation_id": "uuid"}');