import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const url = new URL(req.url);
    const searchParams = url.searchParams;
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const result_type = searchParams.get('result_type');
    const search = searchParams.get('search');
    const labels = searchParams.get('labels')?.split(',').filter(Boolean);
    const is_favorite = searchParams.get('is_favorite');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseClient
      .from('ai_results')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (result_type) {
      query = query.eq('result_type', result_type);
    }

    if (search) {
      query = query.or(`content.ilike.%${search}%,original_text.ilike.%${search}%`);
    }

    if (labels && labels.length > 0) {
      query = query.overlaps('labels', labels);
    }

    if (is_favorite === 'true') {
      query = query.eq('is_favorite', true);
    }

    const { data: aiResults, error: queryError, count } = await query;

    if (queryError) {
      console.error('Error fetching AI results:', queryError);
      throw new Error('Failed to fetch AI results');
    }

    const totalPages = Math.ceil((count || 0) / limit);

    console.log(`Fetched ${aiResults?.length || 0} AI results for user:`, user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: aiResults,
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-ai-results function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});