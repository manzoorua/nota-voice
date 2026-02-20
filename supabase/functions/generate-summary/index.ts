import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUMMARY_TYPES = {
  brief: "Create a brief summary in 2-3 sentences highlighting the most important points.",
  detailed: "Create a detailed summary covering all key points, insights, and conclusions.",
  bullet_points: "Convert the content into clear, organized bullet points.",
  executive: "Create an executive summary focusing on key decisions, outcomes, and action items.",
  key_insights: "Extract and highlight the key insights, learnings, and takeaways.",
  action_items: "Identify and list specific action items, tasks, and next steps mentioned."
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

    const { text, summaryType = 'brief', maxLength, language = 'en' } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const startTime = Date.now();

    // Build the system prompt
    let systemPrompt = SUMMARY_TYPES[summaryType] || SUMMARY_TYPES.brief;
    
    if (maxLength) {
      systemPrompt += ` Keep the summary under ${maxLength} words.`;
    }
    
    if (language !== 'en') {
      systemPrompt += ` Respond in ${language}.`;
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: maxLength ? Math.min(maxLength * 2, 2000) : 1000
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    const summary = result.choices[0].message.content;
    const processingTime = Date.now() - startTime;

    // Save AI result to database
    try {
      const { data: savedResult, error: saveError } = await supabaseClient
        .from('ai_results')
        .insert({
          user_id: user.id,
          content: summary,
          result_type: 'summary',
          original_text: text,
          metadata: {
            summaryType,
            originalLength: text.length,
            summaryLength: summary.length,
            language,
            maxLength
          },
          processing_time_ms: processingTime
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving summary result:', saveError);
        // Continue without failing the request
      } else {
        console.log('Summary result saved:', savedResult.id);
      }
    } catch (saveErr) {
      console.error('Failed to save summary result:', saveErr);
      // Continue without failing the request
    }

    return new Response(
      JSON.stringify({ 
        summary,
        summaryType,
        processingTime,
        originalLength: text.length,
        summaryLength: summary.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Summary generation error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});