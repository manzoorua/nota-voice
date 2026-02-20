-- Fix the last remaining function and address password protection

-- Fix get_system_resilience_score function
CREATE OR REPLACE FUNCTION public.get_system_resilience_score()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  backup_score INTEGER := 0;
  dr_score INTEGER := 0;
  health_score INTEGER := 0;
  overall_score INTEGER := 0;
  backup_count INTEGER;
  active_dr_procedures INTEGER;
  healthy_metrics INTEGER;
  total_metrics INTEGER;
BEGIN
  -- Calculate backup score (0-40 points)
  SELECT COUNT(*) INTO backup_count
  FROM public.backup_configurations
  WHERE is_active = true
    AND last_backup_status = 'success'
    AND last_backup_at > now() - interval '1 day';
  
  backup_score := LEAST(40, backup_count * 10);
  
  -- Calculate disaster recovery score (0-30 points)
  SELECT COUNT(*) INTO active_dr_procedures
  FROM public.disaster_recovery_procedures
  WHERE is_active = true
    AND last_tested_at > now() - interval '6 months';
  
  dr_score := LEAST(30, active_dr_procedures * 10);
  
  -- Calculate system health score (0-30 points)
  SELECT 
    COUNT(*) FILTER (WHERE status = 'healthy'),
    COUNT(*)
  INTO healthy_metrics, total_metrics
  FROM public.system_health_metrics
  WHERE monitoring_enabled = true;
  
  IF total_metrics > 0 THEN
    health_score := ROUND(30.0 * healthy_metrics / total_metrics);
  END IF;
  
  overall_score := backup_score + dr_score + health_score;
  
  RETURN jsonb_build_object(
    'overall_score', overall_score,
    'backup_score', backup_score,
    'disaster_recovery_score', dr_score,
    'system_health_score', health_score,
    'last_calculated', now()
  );
END;
$function$;