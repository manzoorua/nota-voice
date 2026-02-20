import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_STYLE_PROMPTS = {
  clean: "Clean up this text by removing filler words, improving grammar, and organizing thoughts clearly while maintaining the original meaning and tone.",
  summary: "Create a concise summary of the main points from this text, highlighting key information and insights.",
  formal: "Rewrite this text in a formal, professional tone suitable for business communication.",
  casual: "Rewrite this text in a casual, friendly tone suitable for informal communication.",
  bullet_points: "Convert this text into clear, organized bullet points highlighting the main ideas.",
  email: "Format this text as a professional email with appropriate structure and tone."
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

    const { noteId, rawTranscript, text, style = 'clean' } = await req.json();
    const textToProcess = rawTranscript || text;

    if (!textToProcess) {
      throw new Error('Text is required');
    }

    // Update note status to enhancing
    if (noteId) {
      await supabaseClient
        .from('voice_notes')
        .update({ status: 'enhancing' })
        .eq('id', noteId);
    }

    const startTime = Date.now();

    // Get the appropriate prompt for the style
    const systemPrompt = AI_STYLE_PROMPTS[style] || AI_STYLE_PROMPTS.clean;

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
          { role: 'user', content: textToProcess }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    const enhancedContent = result.choices[0].message.content;
    const processingTime = Date.now() - startTime;

    // Generate a title from the enhanced content
    const titleResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { 
            role: 'system', 
            content: 'Generate a short, descriptive title (max 60 characters) for this text content. Return only the title, nothing else.' 
          },
          { role: 'user', content: enhancedContent }
        ],
        temperature: 0.3,
        max_tokens: 20
      }),
    });

    let generatedTitle = 'Voice Note';
    if (titleResponse.ok) {
      const titleResult = await titleResponse.json();
      generatedTitle = titleResult.choices[0].message.content.trim();
    }

    // Update note with enhanced content
    if (noteId) {
      await supabaseClient
        .from('voice_notes')
        .update({
          enhanced_content: enhancedContent,
          content: enhancedContent, // Also save to content for compatibility
          title: generatedTitle,
          status: 'completed',
          processing_metadata: { 
            enhancement_time_ms: processingTime,
            style_used: style
          }
        })
        .eq('id', noteId);
    }

    return new Response(
      JSON.stringify({ 
        enhancedText: enhancedContent,
        title: generatedTitle,
        processingTime 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enhancement error:', error);
    
    // Update note status to error if noteId provided
    const { noteId } = await req.json().catch(() => ({}));
    if (noteId) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );
      
      await supabaseClient
        .from('voice_notes')
        .update({ status: 'error' })
        .eq('id', noteId);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});