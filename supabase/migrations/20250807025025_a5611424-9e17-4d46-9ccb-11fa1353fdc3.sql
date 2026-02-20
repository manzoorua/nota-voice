-- Continue fixing all remaining functions with missing search paths

-- Fix get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'moderator' THEN 2
    WHEN 'user' THEN 3
  END
  LIMIT 1
$function$;

-- Fix get_user_statistics function
CREATE OR REPLACE FUNCTION public.get_user_statistics(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(id uuid, created_at timestamp with time zone, chatbot_count bigint, document_count bigint, embedded_chatbot_count bigint, conversation_count bigint, message_count bigint, total_tokens_used bigint, last_activity_at timestamp with time zone, email text, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    p.id,
    p.created_at,
    COALESCE(cb.chatbot_count, 0)::bigint AS chatbot_count,
    COALESCE(docs.document_count, 0)::bigint AS document_count,
    COALESCE(ecb.embedded_chatbot_count, 0)::bigint AS embedded_chatbot_count,
    COALESCE(ec.conversation_count, 0)::bigint AS conversation_count,
    COALESCE(em.message_count, 0)::bigint AS message_count,
    COALESCE(em.total_tokens_used, 0)::bigint AS total_tokens_used,
    GREATEST(p.updated_at, COALESCE(cb.last_activity, p.created_at), COALESCE(docs.last_activity, p.created_at), COALESCE(ec.last_activity, p.created_at)) AS last_activity_at,
    p.email,
    p.full_name
  FROM public.profiles p
  LEFT JOIN (
    SELECT user_id, count(*) AS chatbot_count, max(updated_at) AS last_activity
    FROM public.chatbots
    WHERE user_id = _user_id
    GROUP BY user_id
  ) cb ON p.id = cb.user_id
  LEFT JOIN (
    SELECT user_id, count(*) AS document_count, max(created_at) AS last_activity
    FROM public.documents
    WHERE user_id = _user_id
    GROUP BY user_id
  ) docs ON p.id = docs.user_id
  LEFT JOIN (
    SELECT user_id, count(*) AS embedded_chatbot_count
    FROM public.embedded_chatbots
    WHERE user_id = _user_id
    GROUP BY user_id
  ) ecb ON p.id = ecb.user_id
  LEFT JOIN (
    SELECT ecb.user_id, count(*) AS conversation_count, max(ec.updated_at) AS last_activity
    FROM public.embedded_conversations ec
    JOIN public.embedded_chatbots ecb ON ec.embedded_chatbot_id = ecb.id
    WHERE ecb.user_id = _user_id
    GROUP BY ecb.user_id
  ) ec ON p.id = ec.user_id
  LEFT JOIN (
    SELECT ecb.user_id, count(*) AS message_count, sum(em.tokens_used) AS total_tokens_used
    FROM public.embedded_messages em
    JOIN public.embedded_conversations ec ON em.embedded_conversation_id = ec.id
    JOIN public.embedded_chatbots ecb ON ec.embedded_chatbot_id = ecb.id
    WHERE ecb.user_id = _user_id
    GROUP BY ecb.user_id
  ) em ON p.id = em.user_id
  WHERE p.id = _user_id;
$function$;