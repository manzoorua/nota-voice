import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese (Simplified)',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'da': 'Danish',
  'no': 'Norwegian',
  'fi': 'Finnish',
  'pl': 'Polish',
  'tr': 'Turkish',
  'th': 'Thai',
  'vi': 'Vietnamese'
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

    const { text, targetLanguage, sourceLanguage = 'auto', preserveFormatting = true } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    if (!targetLanguage) {
      throw new Error('Target language is required');
    }

    console.log(`Translating text from ${sourceLanguage} to ${targetLanguage}`);

    const targetLanguageName = SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage;
    const sourceLanguageName = sourceLanguage === 'auto' ? 'automatically detected language' : (SUPPORTED_LANGUAGES[sourceLanguage] || sourceLanguage);
    
    const formatInstruction = preserveFormatting ? ' Preserve the original formatting, including paragraphs, bullet points, and structure.' : '';
    
    const systemPrompt = `Translate the following text from ${sourceLanguageName} to ${targetLanguageName}. Provide an accurate and natural translation that maintains the original meaning and tone.${formatInstruction}`;

    const startTime = Date.now();

    // Call OpenAI API for translation
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
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    const translatedText = result.choices[0].message.content;
    const processingTime = (Date.now() - startTime) / 1000;

    console.log(`Translation completed in ${processingTime}s`);

    // Save AI result to database
    try {
      const { data: savedResult, error: saveError } = await supabaseClient
        .from('ai_results')
        .insert({
          user_id: user.id,
          content: translatedText,
          result_type: 'translation',
          original_text: text,
          metadata: {
            sourceLanguage,
            targetLanguage,
            targetLanguageName,
            preserveFormatting,
            originalLength: text.length,
            translatedLength: translatedText.length
          },
          processing_time_ms: Math.round(processingTime * 1000)
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving translation result:', saveError);
        // Continue without failing the request
      } else {
        console.log('Translation result saved:', savedResult.id);
      }
    } catch (saveErr) {
      console.error('Failed to save translation result:', saveErr);
      // Continue without failing the request
    }

    return new Response(
      JSON.stringify({ 
        translatedText,
        sourceLanguage,
        targetLanguage,
        targetLanguageName,
        processingTime,
        originalLength: text.length,
        translatedLength: translatedText.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Translation error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});