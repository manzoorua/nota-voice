import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, AlertCircle, Clock, Filter, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: any;
  response_status?: number;
  response_body?: string;
  response_time_ms?: number;
  error_message?: string;
  attempt_number: number;
  success: boolean;
  created_at: string;
  webhooks?: {
    name: string;
    url: string;
  };
}

const WebhookLogs = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    event_type: '',
    success: '',
    webhook_id: '',
    search: ''
  });
  
  const [webhooks, setWebhooks] = useState<Array<{id: string, name: string}>>([]);

  useEffect(() => {
    fetchLogs();
    fetchWebhooks();
  }, [filters]);

  const fetchWebhooks = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-webhooks');
      if (error) throw error;
      setWebhooks(data.webhooks?.map((w: any) => ({ id: w.id, name: w.name })) || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('webhook_logs')
        .select(`
          *,
          webhooks!inner (
            name,
            url,
            user_id
          )
        `)
        .eq('webhooks.user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters.event_type) {
        query = query.eq('event_type', filters.event_type);
      }
      
      if (filters.success !== '') {
        query = query.eq('success', filters.success === 'true');
      }
      
      if (filters.webhook_id) {
        query = query.eq('webhook_id', filters.webhook_id);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      let filteredLogs = data || [];
      
      if (filters.search) {
        filteredLogs = filteredLogs.filter(log => 
          log.event_type.toLowerCase().includes(filters.search.toLowerCase()) ||
          (log.error_message && log.error_message.toLowerCase().includes(filters.search.toLowerCase())) ||
          (log.webhooks?.name && log.webhooks.name.toLowerCase().includes(filters.search.toLowerCase()))
        );
      }
      
      setLogs(filteredLogs);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (log: WebhookLog) => {
    if (log.success) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (log: WebhookLog) => {
    if (log.success) {
      return <Badge className="bg-green-100 text-green-800">Success</Badge>;
    } else {
      return <Badge variant="destructive">Failed</Badge>;
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'Webhook', 'Event Type', 'Status', 'Response Time', 'Attempts', 'Error'].join(','),
      ...logs.map(log => [
        new Date(log.created_at).toISOString(),
        log.webhooks?.name || 'Unknown',
        log.event_type,
        log.success ? 'Success' : 'Failed',
        log.response_time_ms ? `${log.response_time_ms}ms` : 'N/A',
        log.attempt_number,
        log.error_message || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhook-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading webhook logs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Webhook Logs</h2>
          <p className="text-muted-foreground">
            Monitor webhook calls and troubleshoot integration issues
          </p>
        </div>
        
        <Button onClick={exportLogs} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Input
                placeholder="Search logs..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            
            <div>
              <Select value={filters.webhook_id} onValueChange={(value) => setFilters({ ...filters, webhook_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All webhooks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All webhooks</SelectItem>
                  {webhooks.map((webhook) => (
                    <SelectItem key={webhook.id} value={webhook.id}>
                      {webhook.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Select value={filters.event_type} onValueChange={(value) => setFilters({ ...filters, event_type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All events</SelectItem>
                  <SelectItem value="voice_note.created">Voice Note Created</SelectItem>
                  <SelectItem value="voice_note.processed">Voice Note Processed</SelectItem>
                  <SelectItem value="subscription.created">Subscription Created</SelectItem>
                  <SelectItem value="user.registered">User Registered</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Select value={filters.success} onValueChange={(value) => setFilters({ ...filters, success: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="true">Success</SelectItem>
                  <SelectItem value="false">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <div className="space-y-4">
        {logs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No webhook logs found</h3>
              <p className="text-muted-foreground text-center">
                Webhook calls will appear here once you start triggering events
              </p>
            </CardContent>
          </Card>
        ) : (
          logs.map((log) => (
            <Card key={log.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log)}
                    <div>
                      <CardTitle className="text-lg">
                        {log.webhooks?.name || 'Unknown Webhook'}
                      </CardTitle>
                      <CardDescription>
                        {log.event_type} • {new Date(log.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getStatusBadge(log)}
                    {log.attempt_number > 1 && (
                      <Badge variant="outline">Attempt {log.attempt_number}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Response Status:</span>
                    <p className="font-mono">
                      {log.response_status || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-muted-foreground">Response Time:</span>
                    <p>
                      {log.response_time_ms ? `${log.response_time_ms}ms` : 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-muted-foreground">Webhook URL:</span>
                    <p className="font-mono text-xs break-all">
                      {log.webhooks?.url || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-muted-foreground">Event Type:</span>
                    <p>{log.event_type}</p>
                  </div>
                </div>
                
                {log.error_message && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <span className="text-destructive text-sm font-medium">Error:</span>
                    <p className="text-destructive text-sm mt-1">{log.error_message}</p>
                  </div>
                )}
                
                {log.response_body && (
                  <div className="mb-4">
                    <span className="text-muted-foreground text-sm">Response Body:</span>
                    <pre className="text-xs bg-muted p-3 rounded-lg mt-1 overflow-x-auto">
                      {log.response_body}
                    </pre>
                  </div>
                )}
                
                <div>
                  <span className="text-muted-foreground text-sm">Payload:</span>
                  <pre className="text-xs bg-muted p-3 rounded-lg mt-1 overflow-x-auto">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default WebhookLogs;