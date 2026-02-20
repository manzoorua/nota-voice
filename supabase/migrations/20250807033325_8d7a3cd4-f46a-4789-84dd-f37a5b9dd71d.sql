-- Fix security definer view warnings
-- Replace SECURITY DEFINER views with regular views

-- Drop and recreate views without SECURITY DEFINER
DROP VIEW IF EXISTS legacy_profiles_view;
DROP VIEW IF EXISTS legacy_subscriptions_view;
DROP VIEW IF EXISTS legacy_voice_notes_view;

-- Create regular views (non-SECURITY DEFINER)
CREATE VIEW legacy_profiles_view AS
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

CREATE VIEW legacy_subscriptions_view AS
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

CREATE VIEW legacy_voice_notes_view AS
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