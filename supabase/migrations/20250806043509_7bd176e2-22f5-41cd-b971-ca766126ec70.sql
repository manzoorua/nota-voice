-- Create subscribers table for Stripe subscription management
CREATE TABLE public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  subscription_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own subscription info
CREATE POLICY "select_own_subscription" ON public.subscribers
FOR SELECT
USING (user_id = auth.uid() OR email = auth.email());

-- Create policy for edge functions to update subscription info
CREATE POLICY "update_own_subscription" ON public.subscribers
FOR UPDATE
USING (true);

-- Create policy for edge functions to insert subscription info
CREATE POLICY "insert_subscription" ON public.subscribers
FOR INSERT
WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX idx_subscribers_user_id ON public.subscribers(user_id);
CREATE INDEX idx_subscribers_email ON public.subscribers(email);
CREATE INDEX idx_subscribers_stripe_customer_id ON public.subscribers(stripe_customer_id);

-- Create analytics aggregation table
CREATE TABLE public.analytics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_summary ENABLE ROW LEVEL SECURITY;

-- Create policy for system to manage analytics
CREATE POLICY "system_manage_analytics" ON public.analytics_summary
FOR ALL
USING (true);

-- Add indexes
CREATE INDEX idx_analytics_date ON public.analytics_summary(date);
CREATE INDEX idx_analytics_type ON public.analytics_summary(metric_type);

-- Create system settings table
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage settings
CREATE POLICY "admins_manage_settings" ON public.system_settings
FOR ALL
USING (is_admin(auth.uid()));

-- Insert default system settings
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
('free_tier_limits', '{"max_notes": 10, "max_recording_minutes": 3, "monthly_limit": 100}', 'Free tier usage limits'),
('premium_tier_limits', '{"max_notes": -1, "max_recording_minutes": 15, "monthly_limit": -1}', 'Premium tier usage limits'),
('ai_processing_config', '{"model": "whisper-1", "language": "auto", "temperature": 0.3}', 'AI processing configuration'),
('app_settings', '{"maintenance_mode": false, "new_user_signups": true}', 'General application settings');

-- Create function to get user analytics
CREATE OR REPLACE FUNCTION get_user_analytics()
RETURNS TABLE(
  total_users BIGINT,
  active_users BIGINT,
  premium_users BIGINT,
  total_voice_notes BIGINT,
  total_processing_time BIGINT,
  revenue_summary JSONB
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    (SELECT COUNT(*) FROM profiles) as total_users,
    (SELECT COUNT(*) FROM profiles WHERE updated_at > now() - interval '30 days') as active_users,
    (SELECT COUNT(*) FROM subscribers WHERE subscribed = true) as premium_users,
    (SELECT COUNT(*) FROM voice_notes) as total_voice_notes,
    (SELECT COALESCE(SUM(processing_time_seconds), 0) FROM voice_notes) as total_processing_time,
    (SELECT jsonb_build_object(
      'mrr', COALESCE(COUNT(*) * 9.99, 0),
      'arr', COALESCE(COUNT(*) * 9.99 * 12, 0)
    ) FROM subscribers WHERE subscribed = true) as revenue_summary;
$$;

-- Create function to update analytics summary
CREATE OR REPLACE FUNCTION update_analytics_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Daily user stats
  INSERT INTO analytics_summary (date, metric_type, metric_value, metadata)
  SELECT 
    CURRENT_DATE,
    'daily_active_users',
    COUNT(*),
    jsonb_build_object('date', CURRENT_DATE)
  FROM profiles 
  WHERE updated_at::date = CURRENT_DATE
  ON CONFLICT DO NOTHING;

  -- Daily voice notes created
  INSERT INTO analytics_summary (date, metric_type, metric_value, metadata)
  SELECT 
    CURRENT_DATE,
    'daily_voice_notes',
    COUNT(*),
    jsonb_build_object('date', CURRENT_DATE)
  FROM voice_notes 
  WHERE created_at::date = CURRENT_DATE
  ON CONFLICT DO NOTHING;

  -- Daily premium conversions
  INSERT INTO analytics_summary (date, metric_type, metric_value, metadata)
  SELECT 
    CURRENT_DATE,
    'daily_premium_conversions',
    COUNT(*),
    jsonb_build_object('date', CURRENT_DATE)
  FROM subscribers 
  WHERE created_at::date = CURRENT_DATE AND subscribed = true
  ON CONFLICT DO NOTHING;
END;
$$;