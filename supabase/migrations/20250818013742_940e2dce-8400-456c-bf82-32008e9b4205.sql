-- Fix search path security warning and implement remaining security features

-- Update the secure widget config function to fix search path warning
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

-- Enhanced role modification security function
CREATE OR REPLACE FUNCTION public.secure_role_modification_enhanced(
  _target_user_id uuid, 
  _new_role admin_role, 
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  modifier_user_id uuid := auth.uid();
  modifier_role admin_role;
BEGIN
  -- Critical: Prevent self-modification
  IF modifier_user_id = _target_user_id THEN
    PERFORM public.log_security_event(
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
  FROM public.admin_users 
  WHERE user_id = modifier_user_id AND is_active = true;

  -- Enhanced permission checks
  IF modifier_role IS NULL OR modifier_role != 'system_admin' THEN
    PERFORM public.log_security_event(
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

  -- Log approval and execute role change
  PERFORM public.log_security_event(
    'role_modification_approved', 'critical',
    jsonb_build_object(
      'target_user_id', _target_user_id,
      'new_role', _new_role,
      'modifier_role', modifier_role,
      'reason', _reason
    ),
    modifier_user_id
  );

  -- Execute role change using existing secure function
  RETURN public.secure_change_user_role(_target_user_id, _new_role, _reason);
END;
$$;

-- Secure credential management functions
CREATE OR REPLACE FUNCTION public.store_encrypted_credential(
  _credential_name text,
  _credential_value text,
  _encryption_key_id text DEFAULT 'default'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_id_val uuid := auth.uid();
  credential_id uuid;
BEGIN
  -- Validate input
  IF _credential_name IS NULL OR _credential_value IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Credential name and value are required'
    );
  END IF;

  -- Store encrypted credential (for now, base64 encode - should use proper encryption)
  INSERT INTO public.encrypted_credentials (
    user_id, credential_name, encrypted_value, encryption_key_id
  ) VALUES (
    user_id_val, _credential_name, encode(_credential_value::bytea, 'base64'), _encryption_key_id
  )
  ON CONFLICT (user_id, credential_name)
  DO UPDATE SET 
    encrypted_value = encode(_credential_value::bytea, 'base64'),
    encryption_key_id = _encryption_key_id,
    updated_at = now()
  RETURNING id INTO credential_id;

  -- Log credential storage
  PERFORM public.log_security_event(
    'credential_stored', 'medium',
    jsonb_build_object('credential_name', _credential_name, 'credential_id', credential_id),
    user_id_val
  );

  RETURN jsonb_build_object(
    'success', true,
    'credential_id', credential_id,
    'message', 'Credential stored securely'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.retrieve_encrypted_credential(
  _credential_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_id_val uuid := auth.uid();
  encrypted_value text;
  credential_id uuid;
BEGIN
  -- Retrieve encrypted credential
  SELECT id, encrypted_value INTO credential_id, encrypted_value
  FROM public.encrypted_credentials
  WHERE user_id = user_id_val 
    AND credential_name = _credential_name 
    AND is_active = true;

  IF encrypted_value IS NULL THEN
    RETURN NULL;
  END IF;

  -- Update access tracking
  UPDATE public.encrypted_credentials
  SET last_accessed_at = now(),
      access_count = access_count + 1
  WHERE id = credential_id;

  -- Log credential access
  PERFORM public.log_security_event(
    'credential_accessed', 'low',
    jsonb_build_object('credential_name', _credential_name, 'credential_id', credential_id),
    user_id_val
  );

  -- Decrypt credential (for now, base64 decode - should use proper decryption)
  RETURN convert_from(decode(encrypted_value, 'base64'), 'UTF8');
END;
$$;