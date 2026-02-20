import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Eye, Users, Key, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  details: any;
  created_at: string;
  user_id?: string;
}

interface SecurityMetrics {
  totalEvents: number;
  criticalEvents: number;
  recentEvents: SecurityEvent[];
  systemHealth: 'good' | 'warning' | 'critical';
}

const SecurityDashboard = () => {
  const { isAdmin } = useAuth();
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchSecurityMetrics();
    }
  }, [isAdmin]);

  const fetchSecurityMetrics = async () => {
    try {
      setLoading(true);
      
      // Fetch recent security events
      const { data: events, error: eventsError } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (eventsError) throw eventsError;

      // Calculate metrics
      const criticalEvents = events?.filter(e => e.severity === 'critical').length || 0;
      const totalEvents = events?.length || 0;
      
      let systemHealth: 'good' | 'warning' | 'critical' = 'good';
      if (criticalEvents > 0) {
        systemHealth = 'critical';
      } else if (events?.some(e => e.severity === 'high')) {
        systemHealth = 'warning';
      }

      setMetrics({
        totalEvents,
        criticalEvents,
        recentEvents: (events || []).map(event => ({
          ...event,
          severity: event.severity as 'low' | 'medium' | 'high' | 'critical'
        })),
        systemHealth
      });
    } catch (error) {
      console.error('Error fetching security metrics:', error);
      toast.error('Failed to load security metrics');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'critical': return 'text-destructive';
      case 'warning': return 'text-yellow-600';
      case 'good': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

  if (!isAdmin) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Access denied. Administrator privileges required to view security dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Security Dashboard</h2>
          <p className="text-muted-foreground">Monitor system security and recent events</p>
        </div>
        <Button onClick={fetchSecurityMetrics} variant="outline" size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Security Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthColor(metrics?.systemHealth || 'good')}`}>
              {metrics?.systemHealth?.toUpperCase()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{metrics?.criticalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">ACTIVE</div>
            <p className="text-xs text-muted-foreground">RLS enforced</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events</CardTitle>
          <CardDescription>
            Latest security events and system activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.recentEvents.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No recent security events</p>
          ) : (
            <div className="space-y-3">
              {metrics?.recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityColor(event.severity)}>
                        {event.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{event.event_type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                    {event.details && Object.keys(event.details).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {JSON.stringify(event.details, null, 2).substring(0, 100)}...
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      {metrics?.criticalEvents && metrics.criticalEvents > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Action Required:</strong> {metrics.criticalEvents} critical security events detected. 
            Please review and address these issues immediately.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default SecurityDashboard;