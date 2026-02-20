-- Continue with more functions needing search path fixes

-- Fix get_documents_with_stats function
CREATE OR REPLACE FUNCTION public.get_documents_with_stats(p_user_id uuid, p_chatbot_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, filename text, status text, created_at timestamp with time zone, updated_at timestamp with time zone, user_id uuid, chatbot_id uuid, chunk_count bigint, usage_count bigint, last_used_at timestamp with time zone, avg_confidence numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    d.id,
    d.filename,
    d.status,
    d.created_at,
    d.updated_at,
    d.user_id,
    d.chatbot_id,
    COALESCE(da.chunk_count, 0) as chunk_count,
    COALESCE(da.usage_count, 0) as usage_count,
    da.last_used_at,
    COALESCE(da.avg_confidence_score, 0) as avg_confidence
  FROM public.documents d
  LEFT JOIN public.document_analytics da ON da.document_id = d.id
  WHERE d.user_id = p_user_id
    AND (p_chatbot_id IS NULL OR d.chatbot_id = p_chatbot_id)
  ORDER BY d.created_at DESC;
$function$;

-- Fix get_incident_metrics function
CREATE OR REPLACE FUNCTION public.get_incident_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  total_incidents INTEGER;
  open_incidents INTEGER;
  critical_incidents INTEGER;
  avg_resolution_time NUMERIC;
  trends JSONB;
BEGIN
  -- Get total incidents
  SELECT COUNT(*) INTO total_incidents FROM public.security_incidents;
  
  -- Get open incidents
  SELECT COUNT(*) INTO open_incidents FROM public.security_incidents WHERE status IN ('open', 'investigating');
  
  -- Get critical incidents
  SELECT COUNT(*) INTO critical_incidents FROM public.security_incidents WHERE severity = 'critical';
  
  -- Calculate average resolution time (in hours)
  SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) 
  INTO avg_resolution_time 
  FROM public.security_incidents 
  WHERE resolved_at IS NOT NULL;
  
  -- Calculate trends (comparing last 7 days to previous 7 days)
  WITH current_week AS (
    SELECT COUNT(*) as current_count
    FROM public.security_incidents
    WHERE created_at >= now() - interval '7 days'
  ),
  previous_week AS (
    SELECT COUNT(*) as previous_count
    FROM public.security_incidents
    WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days'
  )
  SELECT jsonb_build_object(
    'incidentsChange', 
    CASE WHEN previous_count > 0 
         THEN ROUND(((current_count - previous_count)::numeric / previous_count * 100), 2)
         ELSE 0 
    END,
    'resolutionTimeChange', 0 -- Simplified for now
  )
  INTO trends
  FROM current_week, previous_week;
  
  RETURN jsonb_build_object(
    'totalIncidents', total_incidents,
    'openIncidents', open_incidents,
    'criticalIncidents', critical_incidents,
    'averageResolutionTime', COALESCE(avg_resolution_time, 0),
    'trendsLastWeek', trends
  );
END;
$function$;