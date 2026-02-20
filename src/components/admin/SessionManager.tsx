import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, LogOut, Monitor, Smartphone, Tablet, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface UserSession {
  id: string;
  user_id: string;
  ip_address?: any; // inet type from database
  user_agent?: string;
  last_activity: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

const SessionManager = () => {
  const { isAdmin } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchActiveSessions();
    }
  }, [isAdmin]);

  const fetchActiveSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .order('last_activity', { ascending: false })
        .limit(100);

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate this session?')) return;

    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('Session terminated successfully');
      fetchActiveSessions();
    } catch (error) {
      console.error('Error terminating session:', error);
      toast.error('Failed to terminate session');
    }
  };

  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) return <Monitor className="w-4 h-4" />;
    if (userAgent.includes('Mobile')) return <Smartphone className="w-4 h-4" />;
    if (userAgent.includes('Tablet')) return <Tablet className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const getDeviceType = (userAgent?: string) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  };

  const isSessionExpiringSoon = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 2;
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">You don't have permission to manage user sessions.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Active User Sessions
        </CardTitle>
        <CardDescription>
          Monitor and manage active user sessions across the platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No active sessions found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="mt-1">
                    {getDeviceIcon(session.user_agent)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">
                        {getDeviceType(session.user_agent)}
                      </Badge>
                      {isSessionExpiringSoon(session.expires_at) && (
                        <Badge variant="destructive" className="text-xs">
                          Expiring Soon
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>User ID: {session.user_id}</p>
                      {session.ip_address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>IP: {session.ip_address}</span>
                        </div>
                      )}
                      <p>Last Activity: {new Date(session.last_activity).toLocaleString()}</p>
                      <p>Expires: {new Date(session.expires_at).toLocaleString()}</p>
                      <p>Created: {new Date(session.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => terminateSession(session.id)}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Terminate
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            onClick={fetchActiveSessions}
            disabled={loading}
          >
            Refresh Sessions
          </Button>
          <div className="text-sm text-muted-foreground">
            {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionManager;