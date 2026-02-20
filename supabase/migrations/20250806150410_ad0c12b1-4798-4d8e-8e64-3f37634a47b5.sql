-- Create an enum for business roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user', 'guest');

-- Create user_roles table (separate from profiles as per best practices)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable Row-Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create a security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'manager' THEN 2
      WHEN 'user' THEN 3
      WHEN 'guest' THEN 4
    END
  LIMIT 1
$$;

-- Function to check if user has permission level
CREATE OR REPLACE FUNCTION public.has_permission_level(_user_id UUID, _required_role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
      AND CASE _required_role
        WHEN 'guest' THEN ur.role IN ('guest', 'user', 'manager', 'admin')
        WHEN 'user' THEN ur.role IN ('user', 'manager', 'admin')
        WHEN 'manager' THEN ur.role IN ('manager', 'admin')
        WHEN 'admin' THEN ur.role = 'admin'
      END
  )
$$;

-- Create RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view team roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'manager'));

-- Insert default role for existing users (migrate from profile.role if it exists)
DO $$
DECLARE
    profile_record RECORD;
BEGIN
    FOR profile_record IN 
        SELECT id, role FROM public.profiles WHERE role IS NOT NULL
    LOOP
        INSERT INTO public.user_roles (user_id, role)
        VALUES (
            profile_record.id, 
            CASE profile_record.role
                WHEN 'admin' THEN 'admin'::app_role
                WHEN 'super_admin' THEN 'admin'::app_role
                WHEN 'manager' THEN 'manager'::app_role
                ELSE 'user'::app_role
            END
        )
        ON CONFLICT (user_id, role) DO NOTHING;
    END LOOP;
END $$;

-- Assign default 'user' role to any user without roles
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'user'::app_role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;