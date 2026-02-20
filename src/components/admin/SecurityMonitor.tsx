import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Users, 
  Clock, 
  Ban,
  RefreshCw,
  Eye
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  details: any;
  user_id?: string;
  ip_address?: any;
  user_agent?: string;
  created_at: string;
}

const SecurityMonitor = () => {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    if (isAdmin) {
      fetchSecurityEvents();
    }
  }, [isAdmin, filter]);

  const fetchSecurityEvents = async () => {
    try {
      let query = supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('severity', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching security events:', error);
      toast.error('Failed to load security events');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      case 'medium':
        return <Shield className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getEventDescription = (event: SecurityEvent) => {
    switch (event.event_type) {
      case 'self_role_modification_attempt':
        return 'User attempted to modify their own role';
      case 'admin_role_assignment':
        return 'Admin role was assigned to a user';
      case 'role_changed':
        return `User role changed from ${event.details?.previous_role} to ${event.details?.new_role}`;
      case 'voice_processing_failed':
        return 'Voice note processing failed';
      case 'voice_processing_completed':
        return 'Voice note processed successfully';
      case 'rate_limit_exceeded':
        return `Rate limit exceeded for ${event.details?.endpoint}`;
      default:
        return event.event_type.replace(/_/g, ' ');
    }
  };

  const criticalEvents = events.filter(e => e.severity === 'critical').length;
  const highEvents = events.filter(e => e.severity === 'high').length;
  const recentEvents = events.filter(e => 
    new Date(e.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">You don't have permission to view security events.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalEvents}</div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{highEvents}</div>
            <p className="text-xs text-muted-foreground">
              Need investigation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentEvents}</div>
            <p className="text-xs text-muted-foreground">
              Recent security events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {criticalEvents > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Security Alert</AlertTitle>
          <AlertDescription>
            {criticalEvents} critical security event(s) detected. Review immediately to ensure system integrity.
          </AlertDescription>
        </Alert>
      )}

      {/* Security Events List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Events
              </CardTitle>
              <CardDescription>
                Monitor and analyze security-related activities
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="all">All Events</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchSecurityEvents}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading security events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No security events found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      {getSeverityIcon(event.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getSeverityColor(event.severity) as any}>
                          {event.severity.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium">
                          {getEventDescription(event)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Event: {event.event_type}</p>
                        {event.user_id && (
                          <p>User ID: {event.user_id}</p>
                        )}
                        {event.ip_address && (
                          <p>IP: {event.ip_address}</p>
                        )}
                        <p>Time: {new Date(event.created_at).toLocaleString()}</p>
                        
                        {event.details && Object.keys(event.details).length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800">
                              View Details
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityMonitor;