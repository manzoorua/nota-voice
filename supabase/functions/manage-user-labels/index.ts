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

    const { action, label_name, color_hex, label_id } = await req.json();

    let result;

    switch (action) {
      case 'create':
        if (!label_name) {
          throw new Error('label_name is required for create action');
        }
        
        const { data: newLabel, error: createError } = await supabaseClient
          .from('user_labels')
          .insert({
            user_id: user.id,
            label_name,
            color_hex: color_hex || '#6b7280'
          })
          .select()
          .single();

        if (createError) {
          if (createError.code === '23505') { // Unique constraint violation
            throw new Error('Label already exists');
          }
          throw new Error('Failed to create label');
        }

        result = newLabel;
        break;

      case 'list':
        const { data: labels, error: listError } = await supabaseClient
          .from('user_labels')
          .select('*')
          .eq('user_id', user.id)
          .order('usage_count', { ascending: false });

        if (listError) {
          throw new Error('Failed to fetch labels');
        }

        result = labels;
        break;

      case 'update':
        if (!label_id) {
          throw new Error('label_id is required for update action');
        }

        const updateData: any = {};
        if (label_name) updateData.label_name = label_name;
        if (color_hex) updateData.color_hex = color_hex;

        const { data: updatedLabel, error: updateError } = await supabaseClient
          .from('user_labels')
          .update(updateData)
          .eq('id', label_id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          throw new Error('Failed to update label');
        }

        result = updatedLabel;
        break;

      case 'delete':
        if (!label_id) {
          throw new Error('label_id is required for delete action');
        }

        const { error: deleteError } = await supabaseClient
          .from('user_labels')
          .delete()
          .eq('id', label_id)
          .eq('user_id', user.id);

        if (deleteError) {
          throw new Error('Failed to delete label');
        }

        result = { success: true, message: 'Label deleted successfully' };
        break;

      default:
        throw new Error('Invalid action. Supported actions: create, list, update, delete');
    }

    console.log(`Label ${action} completed successfully for user:`, user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        action
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-user-labels function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});