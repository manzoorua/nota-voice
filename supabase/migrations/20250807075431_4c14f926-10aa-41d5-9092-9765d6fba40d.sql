-- Migration to ensure OAuth authentication works properly
-- This ensures the profiles table is set up correctly for OAuth users

-- Function to handle OAuth user profile creation
CREATE OR REPLACE FUNCTION public.handle_oauth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Insert or update profile for OAuth users
  INSERT INTO public.profiles (id, email, full_name, avatar_url, updated_at)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NOW()
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    email = NEW.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists for OAuth profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_oauth_user();