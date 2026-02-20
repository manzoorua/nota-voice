-- Critical Security Fixes Phase 1

-- 1. Fix the secure_change_user_role function to prevent self-modification and add proper logging
CREATE OR REPLACE FUNCTION public.secure_change_user_role(
    _target_user_id uuid,
    _new_role admin_role,
    _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    modifier_user_id uuid := auth.uid();
    modifier_role admin_role;
    target_current_role admin_role;
    can_modify boolean := false;
    result jsonb;
BEGIN
    -- Check if user is authenticated
    IF modifier_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Authentication required'
        );
    END IF;

    -- Get modifier's role
    SELECT role INTO modifier_role
    FROM admin_users 
    WHERE user_id = modifier_user_id AND is_active = true
    LIMIT 1;

    -- Check if modifier has admin role
    IF modifier_role IS NULL THEN
        -- Log unauthorized attempt
        INSERT INTO security_events (
            event_type, severity, details, user_id
        ) VALUES (
            'unauthorized_role_modification_attempt',
            'high',
            jsonb_build_object(
                'target_user_id', _target_user_id,
                'attempted_role', _new_role,
                'reason', 'modifier_not_admin'
            ),
            modifier_user_id
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient privileges'
        );
    END IF;

    -- CRITICAL: Prevent self-modification (security vulnerability fix)
    IF modifier_user_id = _target_user_id THEN
        -- Log self-modification attempt
        INSERT INTO security_events (
            event_type, severity, details, user_id
        ) VALUES (
            'self_role_modification_attempt',
            'critical',
            jsonb_build_object(
                'attempted_role', _new_role,
                'current_role', modifier_role,
                'reason', _reason
            ),
            modifier_user_id
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Self-modification of roles is not allowed for security reasons'
        );
    END IF;

    -- Get target user's current role
    SELECT role INTO target_current_role
    FROM admin_users
    WHERE user_id = _target_user_id AND is_active = true
    LIMIT 1;

    -- Check permissions based on modifier's role
    CASE modifier_role
        WHEN 'system_admin' THEN
            can_modify := true; -- System admin can modify any role
        WHEN 'developer' THEN
            can_modify := _new_role IN ('developer', 'support', 'template_manager');
        WHEN 'support' THEN
            can_modify := _new_role IN ('support', 'template_manager');
        ELSE
            can_modify := false;
    END CASE;

    -- Additional check: prevent privilege escalation (only system_admin can create system_admin)
    IF _new_role = 'system_admin' AND modifier_role != 'system_admin' THEN
        can_modify := false;
        
        -- Log privilege escalation attempt
        INSERT INTO security_events (
            event_type, severity, details, user_id
        ) VALUES (
            'privilege_escalation_attempt',
            'critical',
            jsonb_build_object(
                'target_user_id', _target_user_id,
                'attempted_role', _new_role,
                'modifier_role', modifier_role,
                'reason', _reason
            ),
            modifier_user_id
        );
    END IF;

    -- If not authorized, log and return error
    IF NOT can_modify THEN
        INSERT INTO security_events (
            event_type, severity, details, user_id
        ) VALUES (
            'unauthorized_role_modification_attempt',
            'high',
            jsonb_build_object(
                'target_user_id', _target_user_id,
                'attempted_role', _new_role,
                'modifier_role', modifier_role,
                'reason', _reason
            ),
            modifier_user_id
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient privileges to assign this role'
        );
    END IF;

    -- Validate reason for admin role assignments
    IF _new_role = 'admin' AND (_reason IS NULL OR length(trim(_reason)) < 10) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Detailed reason (minimum 10 characters) required for admin role assignments'
        );
    END IF;

    -- Perform the role change
    BEGIN
        -- Update or insert the role
        INSERT INTO admin_users (user_id, role, created_by)
        VALUES (_target_user_id, _new_role, modifier_user_id)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            role = _new_role,
            updated_at = now(),
            created_by = modifier_user_id;

        -- Log successful role change
        INSERT INTO security_events (
            event_type, severity, details, user_id
        ) VALUES (
            'admin_role_changed',
            CASE WHEN _new_role IN ('system_admin', 'admin') THEN 'critical' ELSE 'medium' END,
            jsonb_build_object(
                'target_user_id', _target_user_id,
                'old_role', target_current_role,
                'new_role', _new_role,
                'modifier_role', modifier_role,
                'reason', _reason
            ),
            modifier_user_id
        );

        -- Log to admin activity
        INSERT INTO admin_activity_logs (
            admin_user_id,
            action,
            resource_type,
            resource_id,
            details
        ) VALUES (
            (SELECT id FROM admin_users WHERE user_id = modifier_user_id LIMIT 1),
            'role_changed',
            'admin_user',
            _target_user_id::text,
            jsonb_build_object(
                'old_role', target_current_role,
                'new_role', _new_role,
                'reason', _reason
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Role updated successfully',
            'old_role', target_current_role,
            'new_role', _new_role
        );

    EXCEPTION WHEN OTHERS THEN
        -- Log error
        INSERT INTO security_events (
            event_type, severity, details, user_id
        ) VALUES (
            'role_modification_error',
            'high',
            jsonb_build_object(
                'target_user_id', _target_user_id,
                'attempted_role', _new_role,
                'error', SQLERRM
            ),
            modifier_user_id
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Database error occurred'
        );
    END;
END;
$$;

-- 2. Create function to encrypt webhook secrets
CREATE OR REPLACE FUNCTION public.encrypt_webhook_secret(_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    encrypted_secret text;
BEGIN
    -- Use Supabase's built-in encryption
    -- This is a placeholder for actual encryption implementation
    -- In production, you would use a proper encryption key
    SELECT encode(
        digest(_secret || 'webhook_salt_key_2024', 'sha256'),
        'base64'
    ) INTO encrypted_secret;
    
    RETURN encrypted_secret;
END;
$$;

-- 3. Create function to validate webhook secret strength
CREATE OR REPLACE FUNCTION public.validate_webhook_secret_strength(_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    min_length integer := 12;
    has_upper boolean := false;
    has_lower boolean := false;
    has_digit boolean := false;
    has_special boolean := false;
    errors text[] := '{}';
BEGIN
    -- Check minimum length
    IF length(_secret) < min_length THEN
        errors := array_append(errors, 'Secret must be at least ' || min_length || ' characters long');
    END IF;
    
    -- Check for uppercase
    IF _secret !~ '[A-Z]' THEN
        errors := array_append(errors, 'Secret must contain at least one uppercase letter');
    END IF;
    
    -- Check for lowercase
    IF _secret !~ '[a-z]' THEN
        errors := array_append(errors, 'Secret must contain at least one lowercase letter');
    END IF;
    
    -- Check for digits
    IF _secret !~ '[0-9]' THEN
        errors := array_append(errors, 'Secret must contain at least one digit');
    END IF;
    
    -- Check for special characters
    IF _secret !~ '[^A-Za-z0-9]' THEN
        errors := array_append(errors, 'Secret must contain at least one special character');
    END IF;
    
    -- Return validation result
    IF array_length(errors, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'valid', true,
            'strength', 'strong',
            'message', 'Secret meets security requirements'
        );
    ELSE
        RETURN jsonb_build_object(
            'valid', false,
            'strength', 'weak',
            'errors', errors
        );
    END IF;
END;
$$;

-- 4. Create voice processing security function
CREATE OR REPLACE FUNCTION public.check_voice_processing_limit(
    _user_id uuid,
    _duration_seconds integer DEFAULT 180
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    daily_limit integer := 10; -- Free tier limit
    premium_limit integer := 1000; -- Premium limit
    current_count integer;
    current_duration integer;
    user_plan text;
    is_premium boolean := false;
BEGIN
    -- Get user's subscription plan
    SELECT plan_name INTO user_plan
    FROM clean_subscriptions 
    WHERE user_id = _user_id 
    AND status = 'active'
    AND current_period_end > now()
    LIMIT 1;
    
    -- Check if premium
    is_premium := user_plan IS NOT NULL AND user_plan != 'free';
    
    -- Get today's usage
    SELECT 
        COALESCE(processing_count, 0),
        COALESCE(total_duration_seconds, 0)
    INTO current_count, current_duration
    FROM voice_processing_limits
    WHERE user_id = _user_id 
    AND processing_date = CURRENT_DATE;
    
    -- Check limits
    IF is_premium THEN
        IF current_count >= premium_limit THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason', 'Daily premium limit reached',
                'limit', premium_limit,
                'current', current_count
            );
        END IF;
    ELSE
        IF current_count >= daily_limit THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason', 'Daily free limit reached',
                'limit', daily_limit,
                'current', current_count
            );
        END IF;
        
        -- Check duration limit for free users (max 3 minutes per note)
        IF _duration_seconds > 180 THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason', 'Audio duration exceeds 3-minute limit for free users',
                'max_duration', 180,
                'requested_duration', _duration_seconds
            );
        END IF;
    END IF;
    
    -- Update or create usage record
    INSERT INTO voice_processing_limits (
        user_id, processing_date, processing_count, total_duration_seconds
    )
    VALUES (
        _user_id, CURRENT_DATE, 1, _duration_seconds
    )
    ON CONFLICT (user_id, processing_date)
    DO UPDATE SET
        processing_count = voice_processing_limits.processing_count + 1,
        total_duration_seconds = voice_processing_limits.total_duration_seconds + _duration_seconds,
        updated_at = now();
    
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', CASE WHEN is_premium THEN premium_limit - current_count - 1 ELSE daily_limit - current_count - 1 END,
        'plan', CASE WHEN is_premium THEN user_plan ELSE 'free' END
    );
END;
$$;

-- 5. Create session timeout monitoring
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    ip_address inet,
    user_agent text,
    last_activity timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + interval '24 hours'),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_sessions
CREATE POLICY "Users can view own sessions" ON public.user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage sessions" ON public.user_sessions
    FOR ALL USING (true);

-- 6. Create account lockout function
CREATE OR REPLACE FUNCTION public.check_account_lockout(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    lockout_record record;
    max_attempts integer := 5;
    lockout_duration interval := '15 minutes';
BEGIN
    -- Get lockout record
    SELECT * INTO lockout_record
    FROM account_lockouts
    WHERE email = _email;
    
    -- If no record, account is not locked
    IF lockout_record IS NULL THEN
        RETURN jsonb_build_object(
            'locked', false,
            'attempts', 0
        );
    END IF;
    
    -- Check if currently locked
    IF lockout_record.locked_until IS NOT NULL AND lockout_record.locked_until > now() THEN
        RETURN jsonb_build_object(
            'locked', true,
            'locked_until', lockout_record.locked_until,
            'attempts', lockout_record.failed_attempts,
            'reason', 'Too many failed login attempts'
        );
    END IF;
    
    -- Check if approaching limit
    IF lockout_record.failed_attempts >= max_attempts - 1 THEN
        RETURN jsonb_build_object(
            'locked', false,
            'attempts', lockout_record.failed_attempts,
            'warning', 'Account will be locked after one more failed attempt'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'locked', false,
        'attempts', lockout_record.failed_attempts
    );
END;
$$;