-- Phase 1: Database Security Hardening (Fixed)
-- Fix function security and add security audit logging

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

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Admins can view security audit logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "System can create security audit logs" ON public.security_audit_logs;

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

-- Add trigger for admin role changes (drop first to avoid conflicts)
DROP TRIGGER IF EXISTS audit_admin_role_changes_trigger ON public.admin_users;
CREATE TRIGGER audit_admin_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_role_change();