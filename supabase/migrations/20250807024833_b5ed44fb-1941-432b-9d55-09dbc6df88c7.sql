-- Continue with next batch of functions

-- Fix get_admin_role function
CREATE OR REPLACE FUNCTION public.get_admin_role(_user_id uuid)
RETURNS admin_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT role
  FROM public.admin_users
  WHERE user_id = _user_id
    AND is_active = true
  LIMIT 1
$function$;

-- Fix get_conversations_with_stats function
CREATE OR REPLACE FUNCTION public.get_conversations_with_stats(p_chatbot_id uuid)
RETURNS TABLE(id uuid, embedded_chatbot_id uuid, session_id text, created_at timestamp with time zone, updated_at timestamp with time zone, message_count integer, first_message_at timestamp with time zone, last_message_at timestamp with time zone, total_tokens_used integer, page_url text, referrer_url text, user_agent text, country_code text, visitor_metadata jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    ec.id,
    ec.embedded_chatbot_id,
    ec.session_id,
    ec.created_at,
    ec.updated_at,
    ec.message_count,
    ec.first_message_at,
    ec.last_message_at,
    ec.total_tokens_used,
    ec.page_url,
    ec.referrer_url,
    ec.user_agent,
    ec.country_code,
    ec.visitor_metadata
  FROM public.embedded_conversations ec
  WHERE ec.embedded_chatbot_id = p_chatbot_id
  ORDER BY ec.last_message_at DESC NULLS LAST;
$function$;

-- Fix get_document_analytics function
CREATE OR REPLACE FUNCTION public.get_document_analytics(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(document_id uuid, user_id uuid, chatbot_id uuid, filename text, status document_status, created_at timestamp with time zone, chunk_count bigint, usage_count bigint, last_used_at timestamp with time zone, avg_confidence_score numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    d.id AS document_id,
    d.user_id,
    d.chatbot_id,
    d.filename,
    d.status,
    d.created_at,
    COALESCE(count(DISTINCT dv.id), 0) AS chunk_count,
    COALESCE(count(DISTINCT cc.id), 0) AS usage_count,
    max(cc.created_at) AS last_used_at,
    COALESCE(avg(cc.confidence_score), 0) AS avg_confidence_score
  FROM public.documents d
  LEFT JOIN public.document_vectors dv ON dv.document_id = d.id
  LEFT JOIN public.conversation_context cc ON d.id::text = ANY(cc.vector_ids)
  WHERE d.user_id = _user_id
  GROUP BY d.id, d.user_id, d.chatbot_id, d.filename, d.status, d.created_at;
$function$;