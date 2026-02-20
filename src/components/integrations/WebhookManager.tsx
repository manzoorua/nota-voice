import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, TestTube, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import SecretStrengthIndicator from './SecretStrengthIndicator';

interface Webhook {
  id: string;
  name: string;
  description?: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  auth_type: string;
  auth_config: Record<string, any>;
  events: string[];
  is_active: boolean;
  retry_count: number;
  timeout_seconds: number;
  secret_key?: string;
  success_count: number;
  failure_count: number;
  last_triggered_at?: string;
  created_at: string;
  webhook_logs?: any[];
}

interface WebhookEvent {
  id: string;
  event_type: string;
  name: string;
  description: string;
  sample_payload: any;
}

const WebhookManager = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    method: 'POST',
    headers: {},
    auth_type: 'none',
    auth_config: {},
    events: [] as string[],
    retry_count: 3,
    timeout_seconds: 30,
    secret_key: ''
  });

  useEffect(() => {
    fetchWebhooks();
    fetchEvents();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-webhooks');
      
      if (error) throw error;
      
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      toast.error("Failed to fetch webhooks");
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate webhook secret strength if provided
    if (formData.secret_key) {
      const validation = await validateWebhookSecret(formData.secret_key);
      if (!validation.valid) {
        toast.error(`Weak secret: ${validation.errors?.join(', ')}`);
        return;
      }
    }
    
    try {
      const body = editingWebhook 
        ? { id: editingWebhook.id, ...formData }
        : formData;

      const { data, error } = await supabase.functions.invoke('manage-webhooks', {
        body,
        method: editingWebhook ? 'PUT' : 'POST'
      });

      if (error) throw error;

      toast.success(`Webhook ${editingWebhook ? 'updated' : 'created'} successfully`);

      setIsDialogOpen(false);
      resetForm();
      fetchWebhooks();
    } catch (error) {
      console.error('Error saving webhook:', error);
      toast.error(`Failed to ${editingWebhook ? 'update' : 'create'} webhook`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const { error } = await supabase.functions.invoke('manage-webhooks', {
        body: {},
        method: 'DELETE'
      });

      if (error) throw error;

      toast.success("Webhook deleted successfully");

      fetchWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast.error("Failed to delete webhook");
    }
  };

  const handleTest = async (webhook: Webhook) => {
    try {
      const { data, error } = await supabase.functions.invoke('test-webhook', {
        body: {
          webhookId: webhook.id,
          eventType: 'test',
          payload: {
            test: true,
            message: 'This is a test webhook call',
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Webhook test completed successfully");
      } else {
        toast.error(data.error || "Webhook test failed");
      }

      fetchWebhooks(); // Refresh to get updated logs
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast.error("Failed to test webhook");
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      url: '',
      method: 'POST',
      headers: {},
      auth_type: 'none',
      auth_config: {},
      events: [],
      retry_count: 3,
      timeout_seconds: 30,
      secret_key: ''
    });
    setEditingWebhook(null);
  };

  const openEditDialog = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      description: webhook.description || '',
      url: webhook.url,
      method: webhook.method,
      headers: webhook.headers,
      auth_type: webhook.auth_type,
      auth_config: webhook.auth_config,
      events: webhook.events,
      retry_count: webhook.retry_count,
      timeout_seconds: webhook.timeout_seconds,
      secret_key: '' // Don't populate secret on edit for security
    });
    setIsDialogOpen(true);
  };

  const validateWebhookSecret = async (secret: string) => {
    try {
      const { data, error } = await supabase.rpc('validate_webhook_secret_strength', {
        _secret: secret
      });
      
      if (error) throw error;
      return data as { valid: boolean; errors?: string[] };
    } catch (error) {
      console.error('Error validating secret:', error);
      return { valid: false, errors: ['Validation failed'] };
    }
  };

  const validateSecretStrength = (secret: string) => {
    // Client-side validation for immediate feedback
    const errors = [];
    if (secret.length < 12) errors.push('Too short');
    if (!/[A-Z]/.test(secret)) errors.push('No uppercase');
    if (!/[a-z]/.test(secret)) errors.push('No lowercase');
    if (!/[0-9]/.test(secret)) errors.push('No numbers');
    if (!/[^A-Za-z0-9]/.test(secret)) errors.push('No symbols');
    
    return { valid: errors.length === 0, errors };
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading webhooks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Webhook Management</h2>
          <p className="text-muted-foreground">
            Configure webhooks to integrate with external services and automation tools
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingWebhook ? 'Edit Webhook' : 'Create New Webhook'}
              </DialogTitle>
              <DialogDescription>
                Configure your webhook endpoint and settings
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="method">Method</Label>
                  <Select value={formData.method} onValueChange={(value) => setFormData({ ...formData, method: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
                <div>
                  <Label htmlFor="url">Webhook URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => {
                      const url = e.target.value;
                      // Basic URL validation
                      if (url && !url.startsWith('https://')) {
                        toast.error('Webhook URL must use HTTPS for security');
                        return;
                      }
                      setFormData({ ...formData, url });
                    }}
                    placeholder="https://example.com/webhook"
                    pattern="https://.*"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must use HTTPS. HTTP URLs are not allowed for security reasons.
                  </p>
                </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              
              <div>
                <Label>Events to Subscribe</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-center space-x-2">
                      <Switch
                        checked={formData.events.includes(event.event_type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              events: [...formData.events, event.event_type]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              events: formData.events.filter(e => e !== event.event_type)
                            });
                          }
                        }}
                      />
                      <Label className="text-sm">{event.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="retry_count">Retry Count</Label>
                  <Input
                    id="retry_count"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.retry_count}
                    onChange={(e) => setFormData({ ...formData, retry_count: parseInt(e.target.value) })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="timeout_seconds">Timeout (seconds)</Label>
                  <Input
                    id="timeout_seconds"
                    type="number"
                    min="5"
                    max="300"
                    value={formData.timeout_seconds}
                    onChange={(e) => setFormData({ ...formData, timeout_seconds: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              
                <div>
                  <Label htmlFor="secret_key">Secret Key (optional)</Label>
                  <Input
                    id="secret_key"
                    type="password"
                    value={formData.secret_key}
                    onChange={(e) => {
                      const secret = e.target.value;
                      setFormData({ ...formData, secret_key: secret });
                      
                      // Validate secret strength in real-time
                      if (secret.length > 0) {
                        validateSecretStrength(secret);
                      }
                    }}
                    placeholder="Strong secret key for HMAC verification"
                    maxLength={128}
                    minLength={12}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Secret will be encrypted before storage. Minimum 12 characters with uppercase, lowercase, numbers, and symbols.
                  </p>
                  {formData.secret_key && (
                    <SecretStrengthIndicator secret={formData.secret_key} />
                  )}
                </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingWebhook ? 'Update' : 'Create'} Webhook
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {webhooks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <ExternalLink className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No webhooks configured</h3>
              <p className="text-muted-foreground text-center">
                Create your first webhook to start integrating with external services
              </p>
            </CardContent>
          </Card>
        ) : (
          webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {webhook.name}
                      <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{webhook.description || webhook.url}</CardDescription>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(webhook)}
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(webhook)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Method</Label>
                    <p className="font-mono">{webhook.method}</p>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Events</Label>
                    <p>{webhook.events.length} subscribed</p>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Success Rate</Label>
                    <div className="flex items-center gap-1">
                      {webhook.success_count > 0 || webhook.failure_count > 0 ? (
                        <>
                          {webhook.success_count > webhook.failure_count ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          )}
                          <span>
                            {Math.round((webhook.success_count / (webhook.success_count + webhook.failure_count)) * 100)}%
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No calls</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Last Triggered</Label>
                    <p>
                      {webhook.last_triggered_at 
                        ? new Date(webhook.last_triggered_at).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>
                
                {webhook.events.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-muted-foreground">Subscribed Events:</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default WebhookManager;