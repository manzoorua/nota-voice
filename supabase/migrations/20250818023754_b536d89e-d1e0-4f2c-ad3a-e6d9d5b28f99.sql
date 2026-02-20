-- Create database function to enforce 4-note limit per user
CREATE OR REPLACE FUNCTION public.check_and_enforce_note_limit(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_note_count integer;
  oldest_note_id uuid;
  oldest_note_title text;
BEGIN
  -- Count current notes for user
  SELECT COUNT(*) INTO current_note_count
  FROM voice_notes
  WHERE user_id = _user_id;
  
  -- If limit would be exceeded, delete oldest note
  IF current_note_count >= 4 THEN
    SELECT id, title INTO oldest_note_id, oldest_note_title
    FROM voice_notes
    WHERE user_id = _user_id
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Delete oldest note
    DELETE FROM voice_notes WHERE id = oldest_note_id;
    
    RETURN jsonb_build_object(
      'note_deleted', true,
      'deleted_note_id', oldest_note_id,
      'deleted_note_title', oldest_note_title,
      'current_count', current_note_count - 1,
      'limit', 4
    );
  END IF;
  
  RETURN jsonb_build_object(
    'note_deleted', false,
    'current_count', current_note_count,
    'limit', 4,
    'remaining', 4 - current_note_count
  );
END;
$function$;

-- Create function to auto-delete notes older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_old_voice_notes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count integer;
  cutoff_date timestamp with time zone;
BEGIN
  -- Calculate cutoff date (7 days ago)
  cutoff_date := now() - interval '7 days';
  
  -- Delete notes older than 7 days
  WITH deleted_notes AS (
    DELETE FROM voice_notes
    WHERE created_at < cutoff_date
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted_notes;
  
  -- Log cleanup activity
  INSERT INTO security_audit_logs (
    event_category,
    event_source,
    details,
    risk_score
  ) VALUES (
    'system_maintenance',
    'voice_notes_cleanup',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'cutoff_date', cutoff_date,
      'cleanup_time', now()
    ),
    5
  );
  
  RETURN jsonb_build_object(
    'deleted_count', deleted_count,
    'cutoff_date', cutoff_date
  );
END;
$function$;