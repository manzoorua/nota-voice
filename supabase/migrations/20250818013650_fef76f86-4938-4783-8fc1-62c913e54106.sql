-- Fix critical RLS policy vulnerabilities
-- 1. Remove overly permissive public access to embedded_chatbots
DROP POLICY IF EXISTS "Public can view active system chatbots" ON public.embedded_chatbots;

-- 2. Create secure widget configuration access function
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
      5
    );
  END IF;
  
  RETURN widget_config;
END;
$$;

-- 3. Create credential encryption table for secure API key storage
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

-- 4. Enhanced input validation function
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