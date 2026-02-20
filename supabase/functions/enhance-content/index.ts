import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ENHANCEMENT_TYPES = {
  grammar: "Improve grammar, spelling, and punctuation while preserving the original meaning and style.",
  clarity: "Improve clarity and readability by simplifying complex sentences and organizing ideas better.",
  tone_professional: "Enhance the text to have a professional, business-appropriate tone.",
  tone_friendly: "Enhance the text to have a warm, friendly, and approachable tone.",
  tone_academic: "Enhance the text to have a formal, academic tone suitable for research or educational content.",
  expand: "Expand the content with additional details, examples, and explanations while maintaining accuracy.",
  condense: "Condense the content to be more concise while preserving all key information.",
  structure: "Improve the structure and organization of the content with better flow and logical progression.",
  engaging: "Make the content more engaging and interesting while preserving the original message.",
  seo: "Optimize the content for search engines by improving keyword usage and readability."
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

    const { 
      text, 
      enhancementType = 'grammar', 
      targetAudience, 
      customInstructions,
      preserveLength = false 
    } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    console.log(`Enhancing content with type: ${enhancementType}`);

    let systemPrompt = ENHANCEMENT_TYPES[enhancementType] || ENHANCEMENT_TYPES.grammar;
    
    if (targetAudience) {
      systemPrompt += ` Target audience: ${targetAudience}.`;
    }
    
    if (preserveLength) {
      systemPrompt += ' Maintain approximately the same length as the original text.';
    }
    
    if (customInstructions) {
      systemPrompt += ` Additional instructions: ${customInstructions}`;
    }

    const startTime = Date.now();

    // Call OpenAI API for content enhancement
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    const enhancedContent = result.choices[0].message.content;
    const processingTime = (Date.now() - startTime) / 1000;

    console.log(`Content enhancement completed in ${processingTime}s`);

    // Calculate improvement metrics
    const originalWordCount = text.split(/\s+/).length;
    const enhancedWordCount = enhancedContent.split(/\s+/).length;
    const lengthChange = ((enhancedWordCount - originalWordCount) / originalWordCount * 100).toFixed(1);

    // Save AI result to database
    try {
      const { data: savedResult, error: saveError } = await supabaseClient
        .from('ai_results')
        .insert({
          user_id: user.id,
          content: enhancedContent,
          result_type: 'enhancement',
          original_text: text,
          metadata: {
            enhancementType,
            targetAudience,
            customInstructions,
            preserveLength,
            originalWordCount,
            enhancedWordCount,
            lengthChangePercent: parseFloat(lengthChange),
            originalLength: text.length,
            enhancedLength: enhancedContent.length
          },
          processing_time_ms: Math.round(processingTime * 1000)
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving enhancement result:', saveError);
        // Continue without failing the request
      } else {
        console.log('Enhancement result saved:', savedResult.id);
      }
    } catch (saveErr) {
      console.error('Failed to save enhancement result:', saveErr);
      // Continue without failing the request
    }

    return new Response(
      JSON.stringify({ 
        enhancedContent,
        enhancementType,
        processingTime,
        metrics: {
          originalLength: text.length,
          enhancedLength: enhancedContent.length,
          originalWordCount,
          enhancedWordCount,
          lengthChangePercent: lengthChange
        },
        targetAudience,
        customInstructions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Content enhancement error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});