import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, ExternalLink, Settings, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Integration {
  id: string;
  integration_type: string;
  name: string;
  description?: string;
  config: Record<string, any>;
  webhook_url?: string;
  is_active: boolean;
  sync_status: string;
  error_message?: string;
  last_sync_at?: string;
  created_at: string;
}

const IntegrationManager = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  

  const [formData, setFormData] = useState({
    integration_type: 'zapier',
    name: '',
    description: '',
    webhook_url: '',
    config: {}
  });

  const integrationTypes = [
    { value: 'zapier', label: 'Zapier', description: 'Connect to thousands of apps via Zapier' },
    { value: 'n8n', label: 'n8n', description: 'Open source workflow automation' },
    { value: 'make', label: 'Make (Integromat)', description: 'Visual platform for automation' },
    { value: 'slack', label: 'Slack', description: 'Send notifications to Slack channels' },
    { value: 'discord', label: 'Discord', description: 'Send messages to Discord channels' },
    { value: 'custom', label: 'Custom Webhook', description: 'Generic webhook integration' }
  ];

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-integrations');
      
      if (error) throw error;
      
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast.error("Failed to fetch integrations");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const body = editingIntegration 
        ? { id: editingIntegration.id, ...formData }
        : formData;

      const { data, error } = await supabase.functions.invoke('manage-integrations', {
        body,
        method: editingIntegration ? 'PUT' : 'POST'
      });

      if (error) throw error;

      toast.success(`Integration ${editingIntegration ? 'updated' : 'created'} successfully`);

      setIsDialogOpen(false);
      resetForm();
      fetchIntegrations();
    } catch (error) {
      console.error('Error saving integration:', error);
      toast.error(`Failed to ${editingIntegration ? 'update' : 'create'} integration`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;

    try {
      const { error } = await supabase.functions.invoke('manage-integrations', {
        body: {},
        method: 'DELETE'
      });

      if (error) throw error;

      toast.success("Integration deleted successfully");

      fetchIntegrations();
    } catch (error) {
      console.error('Error deleting integration:', error);
      toast.error("Failed to delete integration");
    }
  };

  const handleTestWebhook = async (integration: Integration) => {
    if (!integration.webhook_url) {
      toast.error("No webhook URL configured for this integration");
      return;
    }

    try {
      const response = await fetch(integration.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors',
        body: JSON.stringify({
          test: true,
          message: 'Test message from NotaVoice',
          timestamp: new Date().toISOString(),
          integration_type: integration.integration_type
        })
      });

      toast.success("Test request sent to the integration. Check your destination to verify it was received.");
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast.error("Failed to send test request");
    }
  };

  const resetForm = () => {
    setFormData({
      integration_type: 'zapier',
      name: '',
      description: '',
      webhook_url: '',
      config: {}
    });
    setEditingIntegration(null);
  };

  const openEditDialog = (integration: Integration) => {
    setEditingIntegration(integration);
    setFormData({
      integration_type: integration.integration_type,
      name: integration.name,
      description: integration.description || '',
      webhook_url: integration.webhook_url || '',
      config: integration.config
    });
    setIsDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };

  const renderIntegrationGuide = (type: string) => {
    switch (type) {
      case 'zapier':
        return (
          <div className="text-sm space-y-2 p-3 bg-muted rounded-lg">
            <h4 className="font-medium">Zapier Setup:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Create a new Zap in Zapier</li>
              <li>Choose "Webhooks by Zapier" as the trigger</li>
              <li>Select "Catch Hook" and copy the webhook URL</li>
              <li>Paste the URL below and save</li>
            </ol>
          </div>
        );
      case 'slack':
        return (
          <div className="text-sm space-y-2 p-3 bg-muted rounded-lg">
            <h4 className="font-medium">Slack Setup:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to your Slack workspace settings</li>
              <li>Create a new Incoming Webhook</li>
              <li>Choose the channel to post to</li>
              <li>Copy the webhook URL and paste below</li>
            </ol>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading integrations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Third-Party Integrations</h2>
          <p className="text-muted-foreground">
            Connect with external services and automation platforms
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingIntegration ? 'Edit Integration' : 'Create New Integration'}
              </DialogTitle>
              <DialogDescription>
                Configure a new integration with an external service
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="integration_type">Integration Type</Label>
                <Select 
                  value={formData.integration_type} 
                  onValueChange={(value) => setFormData({ ...formData, integration_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {integrationTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {renderIntegrationGuide(formData.integration_type)}
              
              <div>
                <Label htmlFor="name">Integration Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Zapier Integration"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="webhook_url">Webhook URL</Label>
                <Input
                  id="webhook_url"
                  type="url"
                  value={formData.webhook_url}
                  onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of what this integration does"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingIntegration ? 'Update' : 'Create'} Integration
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {integrations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <ExternalLink className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No integrations configured</h3>
              <p className="text-muted-foreground text-center">
                Create your first integration to connect with external services
              </p>
            </CardContent>
          </Card>
        ) : (
          integrations.map((integration) => (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {integration.name}
                      <Badge variant={integration.is_active ? 'default' : 'secondary'}>
                        {integration.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant={getStatusColor(integration.sync_status)}>
                        {integration.sync_status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {integration.description || `${integration.integration_type} integration`}
                    </CardDescription>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestWebhook(integration)}
                    >
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(integration)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(integration.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p className="capitalize">{integration.integration_type}</p>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Last Sync</Label>
                    <p>
                      {integration.last_sync_at 
                        ? new Date(integration.last_sync_at).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Created</Label>
                    <p>{new Date(integration.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                
                {integration.error_message && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <Label className="text-destructive text-sm font-medium">Error:</Label>
                    <p className="text-destructive text-sm mt-1">{integration.error_message}</p>
                  </div>
                )}
                
                {integration.webhook_url && (
                  <div className="mt-4">
                    <Label className="text-muted-foreground text-xs">Webhook URL:</Label>
                    <p className="text-xs font-mono bg-muted p-2 rounded mt-1 break-all">
                      {integration.webhook_url}
                    </p>
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

export default IntegrationManager;