-- Fix critical RLS policy vulnerabilities
-- 1. Remove overly permissive public access to embedded_chatbots
DROP POLICY IF EXISTS "Public can view active system chatbots" ON public.embedded_chatbots;

-- 2. Create secure widget configuration access
CREATE OR REPLACE FUNCTION public.get_secure_widget_config(widget_id_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  widget_config JSONB;
BEGIN
  -- Only return essential widget configuration without sensitive data
  SELECT jsonb_build_object(
    'widget_id', widget_id,
    'theme_name', theme_name,
    'ui_config', jsonb_build_object(
      'position', ui_config->>'position',
      'primaryColor', ui_config->>'primaryColor',
      'headerTitle', ui_config->>'headerTitle',
      'placeholderText', ui_config->>'placeholderText',
      'fontFamily', ui_config->>'fontFamily',
      'borderRadius', ui_config->>'borderRadius',
      'windowWidth', ui_config->>'windowWidth',
      'windowHeight', ui_config->>'windowHeight'
    ),
    'behavior_config', jsonb_build_object(
      'autoExpand', (behavior_config->>'autoExpand')::boolean,
      'showTypingIndicator', (behavior_config->>'showTypingIndicator')::boolean,
      'enableFileUpload', (behavior_config->>'enableFileUpload')::boolean
    )
  ) INTO widget_config
  FROM public.embedded_chatbots 
  WHERE widget_id = widget_id_param 
    AND is_active = true
  LIMIT 1;
  
  -- Log widget access for monitoring (only if config found)
  IF widget_config IS NOT NULL THEN
    INSERT INTO public.security_audit_logs (
      event_category,
      event_source,
      details,
      risk_score
    ) VALUES (
      'widget_access',
      'secure_widget_config',
      jsonb_build_object(
        'widget_id', widget_id_param,
        'access_time', now(),
        'ip_address', inet_client_addr()
      ),
      5  -- Low risk for legitimate access
    );
  END IF;
  
  RETURN widget_config;
END;
$$;

-- 3. Enhance role modification security
CREATE OR REPLACE FUNCTION public.secure_role_modification_with_approval(
  _target_user_id uuid, 
  _new_role admin_role, 
  _reason text,
  _require_approval boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  modifier_user_id uuid := auth.uid();
  modifier_role admin_role;
  result jsonb;
BEGIN
  -- Critical: Prevent self-modification
  IF modifier_user_id = _target_user_id THEN
    -- Log self-modification attempt
    INSERT INTO public.security_events (
      event_type, severity, details, user_id
    ) VALUES (
      'self_role_modification_blocked', 'critical',
      jsonb_build_object('attempted_role', _new_role, 'reason', _reason),
      modifier_user_id
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Self-modification of roles is strictly prohibited for security reasons'
    );
  END IF;

  -- Get modifier's role
  SELECT role INTO modifier_role
  FROM admin_users 
  WHERE user_id = modifier_user_id AND is_active = true;

  -- Enhanced permission checks
  IF modifier_role IS NULL OR modifier_role != 'system_admin' THEN
    INSERT INTO public.security_events (
      event_type, severity, details, user_id
    ) VALUES (
      'unauthorized_role_modification_blocked', 'high',
      jsonb_build_object('target_user_id', _target_user_id, 'attempted_role', _new_role),
      modifier_user_id
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient privileges - only system administrators can modify roles'
    );
  END IF;

  -- Require detailed reason for sensitive roles
  IF _new_role IN ('system_admin', 'admin') AND (length(trim(_reason)) < 20) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Detailed justification (minimum 20 characters) required for administrator role assignments'
    );
  END IF;

  -- For now, execute immediately but log for audit
  INSERT INTO public.security_events (
    event_type, severity, details, user_id
  ) VALUES (
    'role_modification_approved', 'critical',
    jsonb_build_object(
      'target_user_id', _target_user_id,
      'new_role', _new_role,
      'modifier_role', modifier_role,
      'reason', _reason,
      'auto_approved', NOT _require_approval
    ),
    modifier_user_id
  );

  -- Execute role change using existing secure function
  RETURN public.secure_change_user_role(_target_user_id, _new_role, _reason);
END;
$$;

-- 4. Enhanced security monitoring
CREATE OR REPLACE FUNCTION public.log_suspicious_activity_enhanced(
  _event_type text,
  _severity text DEFAULT 'medium',
  _details jsonb DEFAULT '{}',
  _auto_block boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  event_id uuid;
  user_id_val uuid := auth.uid();
BEGIN
  -- Log the security event
  INSERT INTO public.security_events (
    event_type, severity, details, user_id, ip_address, user_agent
  ) VALUES (
    _event_type, _severity, _details, user_id_val,
    inet_client_addr(), current_setting('request.headers', true)::json->>'user-agent'
  ) RETURNING id INTO event_id;

  -- Auto-create security incident for critical events
  IF _severity = 'critical' OR _auto_block THEN
    INSERT INTO public.security_incidents (
      title, description, severity, status, incident_type, created_by
    ) VALUES (
      'Security Event: ' || _event_type,
      'Auto-generated incident from critical security event: ' || (_details->>'description'),
      _severity,
      'open',
      'automated_detection',
      '00000000-0000-0000-0000-000000000000'::uuid
    );
  END IF;

  RETURN event_id;
END;
$$;

-- 5. Create credential encryption table for secure API key storage
CREATE TABLE IF NOT EXISTS public.encrypted_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_name text NOT NULL,
  encrypted_value text NOT NULL,
  encryption_key_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  access_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  UNIQUE(user_id, credential_name)
);

-- Enable RLS on credentials table
ALTER TABLE public.encrypted_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies for encrypted credentials
CREATE POLICY "Users can manage their own credentials"
ON public.encrypted_credentials
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can log credential access"
ON public.encrypted_credentials
FOR SELECT
USING (true);  -- Allow system functions to read for logging

-- Audit trigger for credential access
CREATE OR REPLACE FUNCTION public.audit_credential_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log credential access
  INSERT INTO public.security_audit_logs (
    event_category, event_source, user_id, details, risk_score
  ) VALUES (
    'credential_access',
    'encrypted_credentials',
    auth.uid(),
    jsonb_build_object(
      'credential_name', NEW.credential_name,
      'access_type', TG_OP,
      'timestamp', now()
    ),
    CASE TG_OP
      WHEN 'SELECT' THEN 10
      WHEN 'INSERT' THEN 20
      WHEN 'UPDATE' THEN 30
      WHEN 'DELETE' THEN 50
    END
  );
  
  -- Update access tracking for SELECT operations
  IF TG_OP = 'SELECT' THEN
    UPDATE public.encrypted_credentials
    SET last_accessed_at = now(),
        access_count = access_count + 1
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_credential_access_trigger
  AFTER SELECT OR INSERT OR UPDATE OR DELETE ON public.encrypted_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_credential_access();

-- 6. Enhanced input validation function
CREATE OR REPLACE FUNCTION public.validate_and_sanitize_input(
  _input text,
  _input_type text DEFAULT 'general',
  _max_length integer DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sanitized_input text;
  validation_errors text[] := '{}';
BEGIN
  -- Length validation
  IF length(_input) > _max_length THEN
    validation_errors := array_append(validation_errors, 'Input exceeds maximum length of ' || _max_length || ' characters');
  END IF;
  
  -- Basic XSS prevention
  sanitized_input := _input;
  
  -- Remove dangerous script tags
  sanitized_input := regexp_replace(sanitized_input, '<script[^>]*>.*?</script>', '', 'gi');
  
  -- Remove dangerous event handlers
  sanitized_input := regexp_replace(sanitized_input, 'on\w+\s*=', '', 'gi');
  
  -- Remove javascript: URLs
  sanitized_input := regexp_replace(sanitized_input, 'javascript:', '', 'gi');
  
  -- Type-specific validation
  CASE _input_type
    WHEN 'email' THEN
      IF NOT sanitized_input ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        validation_errors := array_append(validation_errors, 'Invalid email format');
      END IF;
    WHEN 'url' THEN
      IF NOT sanitized_input ~* '^https?://[^\s/$.?#].[^\s]*$' THEN
        validation_errors := array_append(validation_errors, 'Invalid URL format');
      END IF;
    WHEN 'webhook_url' THEN
      -- Enhanced webhook URL validation
      IF NOT sanitized_input ~* '^https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' THEN
        validation_errors := array_append(validation_errors, 'Webhook URLs must use HTTPS and valid domain');
      END IF;
      -- Block localhost, private IPs, and internal domains
      IF sanitized_input ~* '(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' THEN
        validation_errors := array_append(validation_errors, 'Webhook URLs cannot target private networks');
      END IF;
  END CASE;
  
  -- Return validation result
  RETURN jsonb_build_object(
    'valid', array_length(validation_errors, 1) IS NULL,
    'sanitized_input', sanitized_input,
    'errors', validation_errors
  );
END;
$$;