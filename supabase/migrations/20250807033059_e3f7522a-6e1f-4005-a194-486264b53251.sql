-- Schema Consolidation: Migrate from legacy to clean tables
-- Phase 1: Migrate data and update clean tables to be comprehensive

-- First, let's migrate data from legacy tables to clean tables where they exist

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
  onboarding_completed = p.onboarding_completed,
  onboarding_step = p.onboarding_step,
  onboarding_completed_at = p.onboarding_completed_at,
  selected_template_id = p.selected_template_id,
  default_document_agent_id = p.default_document_agent_id,
  default_chatbot_config = p.default_chatbot_config,
  chat_interface_config = p.chat_interface_config
FROM profiles p
WHERE clean_profiles.id = p.id
  AND (
    clean_profiles.designation IS NULL OR
    clean_profiles.contact_number IS NULL OR
    clean_profiles.company_name IS NULL OR
    clean_profiles.website_url IS NULL OR
    clean_profiles.industry IS NULL OR
    clean_profiles.business_description IS NULL OR
    clean_profiles.onboarding_completed IS NULL OR
    clean_profiles.onboarding_step IS NULL OR
    clean_profiles.default_document_agent_id IS NULL
  );

-- 4. Migrate subscriptions data (legacy -> clean_subscriptions)  
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
  status,
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
  features = s.features
FROM subscriptions s
WHERE clean_subscriptions.user_id = s.user_id;

-- 7. Migrate voice_notes data (legacy -> clean_voice_notes)
INSERT INTO clean_voice_notes (
  user_id,
  title,
  transcription,
  enhanced_content,
  duration_seconds,
  status,
  tags,
  created_at,
  updated_at
)
SELECT 
  user_id,
  title,
  transcription,
  enhanced_content,
  duration_seconds,
  CASE 
    WHEN status = 'completed' THEN 'completed'::clean_voice_note_status
    WHEN status = 'processing' THEN 'processing'::clean_voice_note_status
    WHEN status = 'failed' THEN 'error'::clean_voice_note_status
    ELSE 'processing'::clean_voice_note_status
  END as status,
  tags,
  created_at,
  updated_at
FROM voice_notes
WHERE NOT EXISTS (
  SELECT 1 FROM clean_voice_notes 
  WHERE clean_voice_notes.user_id = voice_notes.user_id 
    AND clean_voice_notes.title = voice_notes.title
    AND clean_voice_notes.created_at = voice_notes.created_at
);

-- 8. Create indexes for better performance on clean tables
CREATE INDEX IF NOT EXISTS idx_clean_profiles_email ON clean_profiles(email);
CREATE INDEX IF NOT EXISTS idx_clean_subscriptions_user_id ON clean_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_clean_subscriptions_status ON clean_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_clean_voice_notes_user_id ON clean_voice_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_clean_voice_notes_status ON clean_voice_notes(status);
CREATE INDEX IF NOT EXISTS idx_clean_voice_notes_created_at ON clean_voice_notes(created_at);

-- 9. Update RLS policies on clean tables to match legacy functionality
-- Clean profiles policies (extend existing)
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

-- Clean subscriptions policies (extend existing)
DROP POLICY IF EXISTS "Users can view their own clean subscription" ON clean_subscriptions;
DROP POLICY IF EXISTS "Users can update their own clean subscription" ON clean_subscriptions;

CREATE POLICY "Users can view their own clean subscription" 
ON clean_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own clean subscription" 
ON clean_subscriptions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clean subscription" 
ON clean_subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 10. Create triggers for clean tables to maintain data consistency
CREATE OR REPLACE FUNCTION update_clean_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_clean_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_clean_voice_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

DROP TRIGGER IF EXISTS update_clean_voice_notes_updated_at_trigger ON clean_voice_notes;
CREATE TRIGGER update_clean_voice_notes_updated_at_trigger
  BEFORE UPDATE ON clean_voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_clean_voice_notes_updated_at();

-- 11. Create views for backward compatibility during transition
CREATE OR REPLACE VIEW legacy_profiles_view AS
SELECT * FROM clean_profiles;

CREATE OR REPLACE VIEW legacy_subscriptions_view AS
SELECT * FROM clean_subscriptions;

CREATE OR REPLACE VIEW legacy_voice_notes_view AS
SELECT * FROM clean_voice_notes;