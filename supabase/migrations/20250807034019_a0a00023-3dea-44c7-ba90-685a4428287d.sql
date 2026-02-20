-- Find and fix remaining SECURITY DEFINER views
-- Drop any remaining SECURITY DEFINER views and recreate them as regular views

-- Check if there are any SECURITY DEFINER views that we missed
DO $$
DECLARE
    view_record RECORD;
BEGIN
    -- Drop all views and recreate them without SECURITY DEFINER
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
        AND viewname IN ('legacy_profiles_view', 'legacy_subscriptions_view', 'legacy_voice_notes_view')
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', view_record.schemaname, view_record.viewname);
    END LOOP;
END $$;

-- Recreate all legacy views as regular views (non-SECURITY DEFINER)
CREATE VIEW public.legacy_profiles_view AS
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

CREATE VIEW public.legacy_subscriptions_view AS
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

CREATE VIEW public.legacy_voice_notes_view AS
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

-- Ensure RLS is enabled on clean tables that the views reference
ALTER TABLE public.clean_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clean_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clean_voice_notes ENABLE ROW LEVEL SECURITY;