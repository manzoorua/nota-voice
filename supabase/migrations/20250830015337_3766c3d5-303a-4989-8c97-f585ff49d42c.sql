-- Phase 1: Database Security Hardening
-- Fix function security and RLS policies

-- Add SECURITY DEFINER with proper search_path to all functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Secure ai_action_categories (currently public)
DROP POLICY IF EXISTS "Everyone can view active categories" ON public.ai_action_categories;
CREATE POLICY "Authenticated users can view ai action categories"
ON public.ai_action_categories
FOR SELECT
TO authenticated
USING (is_active = true);

-- Secure lead_capture_templates (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_capture_templates') THEN
        DROP POLICY IF EXISTS "Public can view templates" ON public.lead_capture_templates;
        
        CREATE POLICY "Users can view their own templates"
        ON public.lead_capture_templates
        FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());
        
        CREATE POLICY "Admins can view all templates"
        ON public.lead_capture_templates
        FOR SELECT
        TO authenticated
        USING (is_admin(auth.uid()));
    END IF;
END $$;

-- Create secure public view for embedded_chatbots (exposing only necessary data)
DROP VIEW IF EXISTS public.embedded_chatbots_public;
CREATE VIEW public.embedded_chatbots_public AS
SELECT 
    widget_id,
    theme_name,
    is_active,
    ui_config,
    behavior_config
FROM public.embedded_chatbots
WHERE is_active = true;

-- Grant access to the public view
GRANT SELECT ON public.embedded_chatbots_public TO anon;

-- Add security audit logging for privilege changes
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_category text NOT NULL,
    event_source text NOT NULL,
    user_id uuid,
    details jsonb DEFAULT '{}',
    risk_score integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on security audit logs
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view security logs
CREATE POLICY "Admins can view security audit logs"
ON public.security_audit_logs
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- System can insert security logs
CREATE POLICY "System can create security audit logs"
ON public.security_audit_logs
FOR INSERT
WITH CHECK (true);

-- Enhanced admin role change logging function
CREATE OR REPLACE FUNCTION public.log_admin_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log all admin role changes to security audit
  INSERT INTO public.security_audit_logs (
    event_category,
    event_source,
    user_id,
    details,
    risk_score
  ) VALUES (
    'admin_role_modification',
    'role_manager_trigger',
    auth.uid(),
    jsonb_build_object(
      'target_user_id', COALESCE(NEW.user_id, OLD.user_id),
      'old_role', OLD.role,
      'new_role', NEW.role,
      'operation', TG_OP,
      'timestamp', now()
    ),
    CASE 
      WHEN NEW.role IN ('system_admin', 'admin') THEN 90
      WHEN NEW.role = 'developer' THEN 70
      ELSE 50
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add trigger for admin role changes
DROP TRIGGER IF EXISTS audit_admin_role_changes_trigger ON public.admin_users;
CREATE TRIGGER audit_admin_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_role_change();