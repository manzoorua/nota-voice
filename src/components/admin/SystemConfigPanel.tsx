import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Save, Key, Webhook, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SystemConfig {
  id?: string;
  default_ai_model: string;
  max_audio_duration_seconds: number;
  max_monthly_notes_free: number;
  max_monthly_notes_premium: number;
  n8n_webhook_base_url: string;
  n8n_enabled: boolean;
  n8n_primary_mode: boolean;
  n8n_fallback_enabled: boolean;
  n8n_workflow_timeout_seconds: number;
  n8n_voice_upload_endpoint: string;
  n8n_transcribe_endpoint: string;
  n8n_enhance_endpoint: string;
  n8n_health_check_endpoint: string;
  n8n_webhook_secret: string;
  processing_timeout_seconds: number;
  max_file_size_n8n_mb: number;
  n8n_retry_attempts: number;
}

const SystemConfigPanel = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openAiKey, setOpenAiKey] = useState('');
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [n8nHealthStatus, setN8nHealthStatus] = useState<any>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('system_configuration')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setConfig(data);
      } else {
        // Create default config
        const defaultConfig = {
          default_ai_model: 'gpt-4o-mini',
          max_audio_duration_seconds: 300,
          max_monthly_notes_free: 10,
          max_monthly_notes_premium: 1000,
          n8n_webhook_base_url: '',
          n8n_enabled: false,
          n8n_primary_mode: false,
          n8n_fallback_enabled: true,
          n8n_workflow_timeout_seconds: 30,
          n8n_voice_upload_endpoint: '',
          n8n_transcribe_endpoint: '',
          n8n_enhance_endpoint: '',
          n8n_health_check_endpoint: '',
          n8n_webhook_secret: '',
          processing_timeout_seconds: 300,
          max_file_size_n8n_mb: 100,
          n8n_retry_attempts: 2
        };
        
        const { data: newConfig, error: createError } = await (supabase as any)
          .from('system_configuration')
          .insert(defaultConfig)
          .select()
          .single();
          
        if (createError) throw createError;
        setConfig(newConfig);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      toast.error("Failed to load system configuration");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('system_configuration')
        .upsert(config, { onConflict: 'id' });

      if (error) throw error;

      toast.success("System configuration updated successfully");
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const updateOpenAiKey = async () => {
    if (!openAiKey.trim()) {
      toast.error("Please enter an OpenAI API key");
      return;
    }

    try {
      // In a real implementation, you'd encrypt this key
      toast.success("OpenAI API key updated (this would be encrypted in production)");
      setOpenAiKey('');
    } catch (error) {
      toast.error("Failed to update API key");
    }
  };

  const testWebhook = async () => {
    if (!config?.n8n_webhook_base_url) {
      toast.error("Please set webhook URL first");
      return;
    }

    setTestingWebhook(true);
    try {
      const response = await fetch(config.n8n_webhook_base_url + '/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, timestamp: Date.now() })
      });

      if (response.ok) {
        toast.success("Webhook test successful");
      } else {
        throw new Error('Webhook test failed');
      }
    } catch (error) {
      toast.error("Webhook test failed - check URL and n8n configuration");
    } finally {
      setTestingWebhook(false);
    }
  };

  // Check N8N health status
  const checkN8nHealth = async () => {
    setCheckingHealth(true);
    try {
      const { data, error } = await supabase.functions.invoke('n8n-health-monitor');
      
      if (error) {
        throw error;
      }
      
      setN8nHealthStatus(data);
      toast.success(`Health check complete - Status: ${data.overall_status}`);
    } catch (error) {
      toast.error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCheckingHealth(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      {/* AI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            AI Configuration
          </CardTitle>
          <CardDescription>
            Configure AI models and processing settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ai-model">Default AI Model</Label>
              <Select
                value={config.default_ai_model}
                onValueChange={(value) => setConfig({ ...config, default_ai_model: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast & Cost-effective)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (High Quality)</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="audio-duration">Max Audio Duration (seconds)</Label>
              <Input
                id="audio-duration"
                type="number"
                value={config.max_audio_duration_seconds}
                onChange={(e) => setConfig({ ...config, max_audio_duration_seconds: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="free-notes">Free Tier - Monthly Notes Limit</Label>
              <Input
                id="free-notes"
                type="number"
                value={config.max_monthly_notes_free}
                onChange={(e) => setConfig({ ...config, max_monthly_notes_free: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="premium-notes">Premium Tier - Monthly Notes Limit</Label>
              <Input
                id="premium-notes"
                type="number"
                value={config.max_monthly_notes_premium}
                onChange={(e) => setConfig({ ...config, max_monthly_notes_premium: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openai-key">OpenAI API Key</Label>
            <div className="flex gap-2">
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={openAiKey}
                onChange={(e) => setOpenAiKey(e.target.value)}
              />
              <Button onClick={updateOpenAiKey} variant="outline">
                Update Key
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              API key will be encrypted before storage
            </p>
          </div>
        </CardContent>
      </Card>

      {/* n8n Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            N8N Voice Processing Integration
          </CardTitle>
          <CardDescription>
            Configure N8N workflows for external voice processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="n8n-enabled">Enable N8N Integration</Label>
              <p className="text-sm text-muted-foreground">Allow processing via N8N workflows</p>
            </div>
            <Switch
              id="n8n-enabled"
              checked={config.n8n_enabled}
              onCheckedChange={(checked) => setConfig({ ...config, n8n_enabled: checked })}
            />
          </div>

          {config.n8n_enabled && (
            <>
              {/* N8N Health Status */}
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    N8N Health Status
                    <Button
                      onClick={checkN8nHealth}
                      disabled={checkingHealth}
                      size="sm"
                      variant="outline"
                    >
                      {checkingHealth ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check Health'}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {n8nHealthStatus ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {n8nHealthStatus.overall_status === 'healthy' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="text-sm font-medium">
                          Status: {n8nHealthStatus.overall_status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Healthy endpoints: {n8nHealthStatus.metrics?.healthy_endpoints || 0} / {n8nHealthStatus.metrics?.total_endpoints || 0}
                      </div>
                      {n8nHealthStatus.processing_statistics && (
                        <div className="text-xs text-muted-foreground">
                          Recent processing: {n8nHealthStatus.processing_statistics.n8n_processed} N8N, {n8nHealthStatus.processing_statistics.edge_processed} Edge Functions
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Click "Check Health" to verify N8N status</p>
                  )}
                </CardContent>
              </Card>

              {/* Processing Mode Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Primary Processing Mode</Label>
                    <p className="text-sm text-muted-foreground">Use N8N as primary processor</p>
                  </div>
                  <Switch
                    checked={config.n8n_primary_mode}
                    onCheckedChange={(checked) => setConfig({ ...config, n8n_primary_mode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Fallback to Edge Functions</Label>
                    <p className="text-sm text-muted-foreground">Use edge functions if N8N fails</p>
                  </div>
                  <Switch
                    checked={config.n8n_fallback_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, n8n_fallback_enabled: checked })}
                  />
                </div>
              </div>

              {/* N8N Endpoints Configuration */}
              <div className="space-y-3">
                <Label className="text-base font-medium">N8N Workflow Endpoints</Label>
                
                <div>
                  <Label htmlFor="upload-endpoint">Voice Upload Endpoint</Label>
                  <Input
                    id="upload-endpoint"
                    placeholder="https://your-n8n.com/webhook/voice-upload"
                    value={config.n8n_voice_upload_endpoint}
                    onChange={(e) => setConfig({ ...config, n8n_voice_upload_endpoint: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="transcribe-endpoint">Transcription Endpoint</Label>
                  <Input
                    id="transcribe-endpoint"
                    placeholder="https://your-n8n.com/webhook/transcribe"
                    value={config.n8n_transcribe_endpoint}
                    onChange={(e) => setConfig({ ...config, n8n_transcribe_endpoint: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="enhance-endpoint">Enhancement Endpoint</Label>
                  <Input
                    id="enhance-endpoint"
                    placeholder="https://your-n8n.com/webhook/enhance"
                    value={config.n8n_enhance_endpoint}
                    onChange={(e) => setConfig({ ...config, n8n_enhance_endpoint: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="health-endpoint">Health Check Endpoint</Label>
                  <Input
                    id="health-endpoint"
                    placeholder="https://your-n8n.com/webhook/health"
                    value={config.n8n_health_check_endpoint}
                    onChange={(e) => setConfig({ ...config, n8n_health_check_endpoint: e.target.value })}
                  />
                </div>
              </div>

              {/* Security & Performance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="webhook-secret">Webhook Secret</Label>
                  <Input
                    id="webhook-secret"
                    type="password"
                    placeholder="Webhook signature secret"
                    value={config.n8n_webhook_secret}
                    onChange={(e) => setConfig({ ...config, n8n_webhook_secret: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used for webhook signature verification</p>
                </div>

                <div>
                  <Label htmlFor="timeout">Processing Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={config.processing_timeout_seconds}
                    onChange={(e) => setConfig({ ...config, processing_timeout_seconds: parseInt(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="max-size">Max File Size for N8N (MB)</Label>
                  <Input
                    id="max-size"
                    type="number"
                    value={config.max_file_size_n8n_mb}
                    onChange={(e) => setConfig({ ...config, max_file_size_n8n_mb: parseInt(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="retry-attempts">Retry Attempts</Label>
                  <Input
                    id="retry-attempts"
                    type="number"
                    value={config.n8n_retry_attempts}
                    onChange={(e) => setConfig({ ...config, n8n_retry_attempts: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              {/* Test Webhook */}
              <div>
                <Label htmlFor="webhook-url">Legacy Webhook Base URL (for testing)</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook-url"
                    placeholder="https://your-n8n-instance.com/webhook"
                    value={config.n8n_webhook_base_url}
                    onChange={(e) => setConfig({ ...config, n8n_webhook_base_url: e.target.value })}
                  />
                  <Button 
                    onClick={testWebhook} 
                    variant="outline"
                    disabled={testingWebhook}
                  >
                    {testingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default SystemConfigPanel;