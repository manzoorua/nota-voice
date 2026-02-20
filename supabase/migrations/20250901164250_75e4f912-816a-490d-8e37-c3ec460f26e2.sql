-- Create helper function for incrementing label usage
CREATE OR REPLACE FUNCTION public.increment_label_usage(p_user_id uuid, p_label_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_labels 
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE user_id = p_user_id AND label_name = p_label_name;
END;
$$;