-- Schema Consolidation: Migrate from legacy to clean tables (Fixed enum mapping)

-- 1. Migrate profiles data (legacy -> clean_profiles)
INSERT INTO clean_profiles (id, email, full_name, avatar_url, created_at, updated_at)
SELECT 
  id,
  email,
  full_name,
  avatar_url,
  created_at,
  updated_at
FROM profiles
WHERE NOT EXISTS (
  SELECT 1 FROM clean_profiles WHERE clean_profiles.id = profiles.id
);

-- 2. Add missing columns to clean_profiles to match legacy profiles functionality
ALTER TABLE clean_profiles 
ADD COLUMN IF NOT EXISTS designation text,
ADD COLUMN IF NOT EXISTS contact_number text,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS website_url text,
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS business_description text,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS selected_template_id text,
ADD COLUMN IF NOT EXISTS default_document_agent_id uuid,
ADD COLUMN IF NOT EXISTS default_chatbot_config jsonb,
ADD COLUMN IF NOT EXISTS chat_interface_config jsonb;

-- 3. Update clean_profiles with additional data from legacy profiles
UPDATE clean_profiles 
SET 
  designation = p.designation,
  contact_number = p.contact_number,
  company_name = p.company_name,
  website_url = p.website_url,
  industry = p.industry,
  business_description = p.business_description,
  onboarding_completed = COALESCE(p.onboarding_completed, false),
  onboarding_step = COALESCE(p.onboarding_step, 0),
  onboarding_completed_at = p.onboarding_completed_at,
  selected_template_id = p.selected_template_id,
  default_document_agent_id = p.default_document_agent_id,
  default_chatbot_config = p.default_chatbot_config,
  chat_interface_config = p.chat_interface_config
FROM profiles p
WHERE clean_profiles.id = p.id;

-- 4. Migrate subscriptions data with proper enum mapping
-- Clean enum: active, canceled, past_due, trialing
-- Legacy enum: active, canceled, past_due, incomplete
INSERT INTO clean_subscriptions (
  user_id, 
  status, 
  plan_name, 
  current_period_start, 
  current_period_end,
  monthly_notes_limit,
  created_at, 
  updated_at
)
SELECT 
  user_id,
  CASE 
    WHEN status::text = 'active' THEN 'active'::clean_subscription_status
    WHEN status::text = 'canceled' THEN 'canceled'::clean_subscription_status
    WHEN status::text = 'past_due' THEN 'past_due'::clean_subscription_status
    WHEN status::text = 'incomplete' THEN 'active'::clean_subscription_status -- Map incomplete to active
    ELSE 'active'::clean_subscription_status
  END as status,
  plan_name,
  current_period_start,
  current_period_end,
  CASE 
    WHEN plan_name = 'premium' THEN 1000
    WHEN plan_name = 'pro' THEN 500
    ELSE 10
  END as monthly_notes_limit,
  created_at,
  updated_at
FROM subscriptions
WHERE NOT EXISTS (
  SELECT 1 FROM clean_subscriptions WHERE clean_subscriptions.user_id = subscriptions.user_id
);

-- 5. Add missing columns to clean_subscriptions to match legacy functionality
ALTER TABLE clean_subscriptions
ADD COLUMN IF NOT EXISTS monthly_message_limit integer,
ADD COLUMN IF NOT EXISTS monthly_token_limit integer,
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{}'::jsonb;

-- 6. Update clean_subscriptions with additional data from legacy subscriptions
UPDATE clean_subscriptions
SET 
  monthly_message_limit = s.monthly_message_limit,
  monthly_token_limit = s.monthly_token_limit,
  features = COALESCE(s.features, '{}'::jsonb)
FROM subscriptions s
WHERE clean_subscriptions.user_id = s.user_id;

-- 7. Create indexes for better performance on clean tables
CREATE INDEX IF NOT EXISTS idx_clean_profiles_email ON clean_profiles(email);
CREATE INDEX IF NOT EXISTS idx_clean_subscriptions_user_id ON clean_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_clean_subscriptions_status ON clean_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_clean_voice_notes_user_id ON clean_voice_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_clean_voice_notes_status ON clean_voice_notes(status);
CREATE INDEX IF NOT EXISTS idx_clean_voice_notes_created_at ON clean_voice_notes(created_at);

-- 8. Update RLS policies on clean tables to match legacy functionality
-- Clean profiles policies
DROP POLICY IF EXISTS "Users can view their own clean profile" ON clean_profiles;
DROP POLICY IF EXISTS "Users can update their own clean profile" ON clean_profiles;
DROP POLICY IF EXISTS "Users can insert their own clean profile" ON clean_profiles;

CREATE POLICY "Users can view their own clean profile" 
ON clean_profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own clean profile" 
ON clean_profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own clean profile" 
ON clean_profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Clean subscriptions policies
DROP POLICY IF EXISTS "Users can view their own clean subscription" ON clean_subscriptions;
DROP POLICY IF EXISTS "Users can update their own clean subscription" ON clean_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own clean subscription" ON clean_subscriptions;

CREATE POLICY "Users can view their own clean subscription" 
ON clean_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own clean subscription" 
ON clean_subscriptions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clean subscription" 
ON clean_subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 9. Create triggers for clean tables to maintain data consistency
CREATE OR REPLACE FUNCTION update_clean_profiles_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_clean_subscriptions_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS update_clean_profiles_updated_at_trigger ON clean_profiles;
CREATE TRIGGER update_clean_profiles_updated_at_trigger
  BEFORE UPDATE ON clean_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_clean_profiles_updated_at();

DROP TRIGGER IF EXISTS update_clean_subscriptions_updated_at_trigger ON clean_subscriptions;
CREATE TRIGGER update_clean_subscriptions_updated_at_trigger
  BEFORE UPDATE ON clean_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_clean_subscriptions_updated_at();

-- 10. Create compatibility views for gradual migration
CREATE OR REPLACE VIEW legacy_profiles_view AS
SELECT 
  id,
  email,
  full_name,
  avatar_url,
  designation,
  contact_number,
  company_name,
  website_url,
  industry,
  business_description,
  onboarding_completed,
  onboarding_step,
  onboarding_completed_at,
  selected_template_id,
  default_document_agent_id,
  default_chatbot_config,
  chat_interface_config,
  created_at,
  updated_at
FROM clean_profiles;

CREATE OR REPLACE VIEW legacy_subscriptions_view AS
SELECT 
  id,
  user_id,
  CASE 
    WHEN status::text = 'active' THEN 'active'::subscription_status
    WHEN status::text = 'canceled' THEN 'canceled'::subscription_status
    WHEN status::text = 'past_due' THEN 'past_due'::subscription_status
    WHEN status::text = 'trialing' THEN 'active'::subscription_status
    ELSE 'active'::subscription_status
  END as status,
  plan_name,
  current_period_start,
  current_period_end,
  monthly_message_limit,
  monthly_token_limit,
  features,
  created_at,
  updated_at
FROM clean_subscriptions;

CREATE OR REPLACE VIEW legacy_voice_notes_view AS
SELECT 
  id,
  user_id,
  title,
  transcription,
  enhanced_content,
  audio_url,
  duration_seconds,
  status::text as status,
  tags,
  created_at,
  updated_at
FROM clean_voice_notes;