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

    // Verify admin access
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: adminUser } = await supabaseClient
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      throw new Error('Admin access required');
    }

    // Get system configuration
    const { data: config } = await supabaseClient
      .from('system_configuration')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!config?.n8n_enabled) {
      return new Response(
        JSON.stringify({ 
          n8n_enabled: false,
          message: 'N8N integration is disabled'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting N8N health check...');

    // Perform health checks on all configured endpoints
    const healthChecks = [];
    const endpoints = [
      { name: 'upload', url: config.n8n_voice_upload_endpoint },
      { name: 'transcribe', url: config.n8n_transcribe_endpoint },
      { name: 'enhance', url: config.n8n_enhance_endpoint },
      { name: 'health', url: config.n8n_health_check_endpoint }
    ];

    for (const endpoint of endpoints) {
      if (endpoint.url) {
        healthChecks.push(checkEndpointHealth(endpoint.name, endpoint.url, config));
      }
    }

    const results = await Promise.allSettled(healthChecks);
    
    // Compile health status
    const healthStatus = {
      n8n_enabled: true,
      overall_status: 'healthy',
      endpoints: {} as Record<string, any>,
      metrics: {
        total_endpoints: endpoints.filter(e => e.url).length,
        healthy_endpoints: 0,
        failed_endpoints: 0,
        average_response_time: 0
      },
      last_check: new Date().toISOString()
    };

    let totalResponseTime = 0;
    let successfulChecks = 0;

    results.forEach((result, index) => {
      const endpointName = endpoints[index].name;
      
      if (result.status === 'fulfilled') {
        healthStatus.endpoints[endpointName] = result.value;
        if (result.value.status === 'healthy') {
          healthStatus.metrics.healthy_endpoints++;
          totalResponseTime += result.value.response_time_ms;
          successfulChecks++;
        } else {
          healthStatus.metrics.failed_endpoints++;
        }
      } else {
        healthStatus.endpoints[endpointName] = {
          status: 'error',
          error: result.reason?.message || 'Unknown error',
          response_time_ms: 0
        };
        healthStatus.metrics.failed_endpoints++;
      }
    });

    // Calculate overall status
    if (healthStatus.metrics.failed_endpoints > 0) {
      healthStatus.overall_status = healthStatus.metrics.healthy_endpoints > 0 ? 'degraded' : 'unhealthy';
    }

    healthStatus.metrics.average_response_time = successfulChecks > 0 ? 
      Math.round(totalResponseTime / successfulChecks) : 0;

    // Get recent processing statistics
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: recentProcessing } = await supabaseClient
      .from('voice_notes')
      .select('processing_method, status, created_at')
      .gte('created_at', thirtyMinutesAgo);

    const processingStats = {
      total_recent: recentProcessing?.length || 0,
      n8n_processed: recentProcessing?.filter(n => n.processing_method === 'n8n').length || 0,
      edge_processed: recentProcessing?.filter(n => n.processing_method === 'edge_functions').length || 0,
      hybrid_processed: recentProcessing?.filter(n => n.processing_method === 'hybrid').length || 0,
      completed: recentProcessing?.filter(n => n.status === 'completed').length || 0,
      failed: recentProcessing?.filter(n => n.status === 'failed').length || 0,
      processing: recentProcessing?.filter(n => n.status === 'processing').length || 0
    };

    // Log health check results
    await supabaseClient
      .from('security_audit_logs')
      .insert({
        event_category: 'n8n_health_check',
        event_source: 'n8n_health_monitor',
        user_id: user.id,
        details: {
          health_status: healthStatus.overall_status,
          endpoints_checked: healthStatus.metrics.total_endpoints,
          healthy_endpoints: healthStatus.metrics.healthy_endpoints,
          failed_endpoints: healthStatus.metrics.failed_endpoints,
          average_response_time: healthStatus.metrics.average_response_time,
          processing_stats: processingStats
        },
        risk_score: healthStatus.overall_status === 'healthy' ? 10 : 
                   healthStatus.overall_status === 'degraded' ? 30 : 50
      });

    return new Response(
      JSON.stringify({ 
        ...healthStatus,
        processing_statistics: processingStats,
        configuration: {
          n8n_primary_mode: config.n8n_primary_mode,
          n8n_fallback_enabled: config.n8n_fallback_enabled,
          processing_timeout_seconds: config.processing_timeout_seconds,
          max_file_size_n8n_mb: config.max_file_size_n8n_mb,
          n8n_retry_attempts: config.n8n_retry_attempts
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('N8N health monitor error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function checkEndpointHealth(name: string, url: string, config: any): Promise<any> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (config.processing_timeout_seconds || 30) * 1000);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Supabase-Health-Check/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      response_time_ms: responseTime,
      status_code: response.status,
      last_check: new Date().toISOString()
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'error',
      response_time_ms: responseTime,
      error: error.message,
      last_check: new Date().toISOString()
    };
  }
}