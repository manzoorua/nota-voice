-- Fix get_documents_with_stats function to use existing tables
CREATE OR REPLACE FUNCTION public.get_documents_with_stats(p_user_id uuid, p_chatbot_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, filename text, status text, created_at timestamp with time zone, updated_at timestamp with time zone, user_id uuid, chatbot_id uuid, chunk_count bigint, usage_count bigint, last_used_at timestamp with time zone, avg_confidence numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    d.id,
    d.filename,
    d.status::text,
    d.created_at,
    d.updated_at,
    d.user_id,
    d.chatbot_id,
    COALESCE(COUNT(DISTINCT dv.id), 0) as chunk_count,
    0::bigint as usage_count, -- Placeholder since no analytics table exists
    NULL::timestamp with time zone as last_used_at,
    0::numeric as avg_confidence
  FROM public.documents d
  LEFT JOIN public.document_vectors dv ON dv.document_id = d.id
  WHERE d.user_id = p_user_id
    AND (p_chatbot_id IS NULL OR d.chatbot_id = p_chatbot_id)
  GROUP BY d.id, d.filename, d.status, d.created_at, d.updated_at, d.user_id, d.chatbot_id
  ORDER BY d.created_at DESC;
$function$;

-- Continue with more function fixes
-- Fix get_system_configuration function
CREATE OR REPLACE FUNCTION public.get_system_configuration()
RETURNS TABLE(id uuid, default_embedding_model text, default_embedding_dimensions integer, default_chunk_size integer, default_chunk_overlap integer, default_chunking_strategy text, processing_mode text, n8n_webhook_base_url text, global_webhook_timeout_seconds integer, global_webhook_retry_count integer, webhook_rate_limit_per_minute integer, max_concurrent_processing_jobs integer, processing_queue_timeout_minutes integer, require_api_key_encryption boolean, max_document_size_mb integer, allowed_file_types text[], created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    id, default_embedding_model, default_embedding_dimensions, default_chunk_size,
    default_chunk_overlap, default_chunking_strategy, processing_mode, n8n_webhook_base_url,
    global_webhook_timeout_seconds, global_webhook_retry_count, webhook_rate_limit_per_minute,
    max_concurrent_processing_jobs, processing_queue_timeout_minutes, require_api_key_encryption,
    max_document_size_mb, allowed_file_types, created_at, updated_at
  FROM public.system_configuration
  ORDER BY created_at DESC
  LIMIT 1;
$function$;