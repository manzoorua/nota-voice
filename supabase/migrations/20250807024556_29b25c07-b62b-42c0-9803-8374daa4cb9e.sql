-- Phase 1: Critical Security Fixes
-- Fix function search paths to prevent SQL injection vulnerabilities

-- Fix audit_admin_role_changes function
CREATE OR REPLACE FUNCTION public.audit_admin_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Log role changes
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    -- Log to security events
    INSERT INTO public.security_events (
      event_type,
      severity,
      details,
      user_id
    ) VALUES (
      'admin_role_changed',
      'critical',
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'target_user_id', NEW.user_id,
        'modified_by', auth.uid()
      ),
      auth.uid()
    );
    
    -- Log to admin activity logs
    INSERT INTO public.admin_activity_logs (
      admin_user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      (SELECT id FROM public.admin_users WHERE user_id = auth.uid() LIMIT 1),
      'role_changed',
      'admin_user',
      NEW.id::text,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'target_user_id', NEW.user_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix batch_delete_documents function
CREATE OR REPLACE FUNCTION public.batch_delete_documents(document_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Delete document vectors first (foreign key dependency)
  DELETE FROM public.document_vectors WHERE document_id = ANY(document_ids);
  
  -- Delete from document search index
  DELETE FROM public.document_search_index WHERE document_id = ANY(document_ids);
  
  -- Delete processing pipelines
  DELETE FROM public.processing_pipelines WHERE document_id = ANY(document_ids);
  
  -- Finally delete documents
  DELETE FROM public.documents WHERE id = ANY(document_ids);
END;
$function$;

-- Fix batch_delete_embedded_chatbots function
CREATE OR REPLACE FUNCTION public.batch_delete_embedded_chatbots(chatbot_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Delete messages first
  DELETE FROM public.embedded_messages 
  WHERE embedded_conversation_id IN (
    SELECT id FROM public.embedded_conversations 
    WHERE embedded_chatbot_id = ANY(chatbot_ids)
  );
  
  -- Delete conversations
  DELETE FROM public.embedded_conversations WHERE embedded_chatbot_id = ANY(chatbot_ids);
  
  -- Delete analytics data
  DELETE FROM public.conversion_funnel_analytics WHERE embedded_chatbot_id = ANY(chatbot_ids);
  DELETE FROM public.form_abandonment_logs WHERE embedded_chatbot_id = ANY(chatbot_ids);
  DELETE FROM public.traffic_attribution WHERE embedded_chatbot_id = ANY(chatbot_ids);
  DELETE FROM public.widget_access_logs WHERE embedded_chatbot_id = ANY(chatbot_ids);
  
  -- Delete business intelligence reports
  DELETE FROM public.business_intelligence_reports WHERE embedded_chatbot_id = ANY(chatbot_ids);
  
  -- Finally delete the chatbots
  DELETE FROM public.embedded_chatbots WHERE id = ANY(chatbot_ids);
END;
$function$;

-- Add missing can_modify_admin_role function that's referenced in RLS policies
CREATE OR REPLACE FUNCTION public.can_modify_admin_role(_modifier_id uuid, _target_user_id uuid, _new_role admin_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only system admins can modify admin roles
  -- And users cannot modify their own roles to prevent privilege escalation
  RETURN public.is_admin(_modifier_id, 'system_admin'::admin_role) 
    AND _modifier_id != _target_user_id;
END;
$function$;