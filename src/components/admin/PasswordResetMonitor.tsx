import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle, Clock, Search } from 'lucide-react';

interface PasswordResetLog {
  id: string;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

interface RateLimit {
  id: string;
  email: string;
  ip_address: string | null;
  reset_attempts: number;
  last_attempt_at: string;
  locked_until: string | null;
}

export const PasswordResetMonitor: React.FC = () => {
  const [logs, setLogs] = useState<PasswordResetLog[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch password reset logs
      const { data: logsData, error: logsError } = await supabase
        .from('password_reset_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) {
        console.error('Error fetching logs:', logsError);
      } else {
        setLogs((logsData || []) as PasswordResetLog[]);
      }

      // Fetch rate limits
      const { data: rateLimitsData, error: rateLimitsError } = await supabase
        .from('password_reset_rate_limits')
        .select('*')
        .order('last_attempt_at', { ascending: false });

      if (rateLimitsError) {
        console.error('Error fetching rate limits:', rateLimitsError);
      } else {
        setRateLimits((rateLimitsData || []) as RateLimit[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLogs = logs.filter(log => {
    const emailMatch = !emailFilter || log.email.toLowerCase().includes(emailFilter.toLowerCase());
    const ipMatch = !ipFilter || log.ip_address?.includes(ipFilter);
    return emailMatch && ipMatch;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <AlertTriangle className="w-4 h-4 text-red-600" />
    );
  };

  const isCurrentlyLocked = (lockedUntil: string | null) => {
    return lockedUntil && new Date(lockedUntil) > new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading password reset data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Password Reset Monitoring</h2>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="email-filter">Filter by Email</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                id="email-filter"
                placeholder="Search emails..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ip-filter">Filter by IP</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                id="ip-filter"
                placeholder="Search IP addresses..."
                value={ipFilter}
                onChange={(e) => setIpFilter(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-end">
            <Button onClick={fetchData} variant="outline">
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* Rate Limits Overview */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Current Rate Limits</h3>
        <div className="grid gap-4">
          {rateLimits.length === 0 ? (
            <p className="text-muted-foreground">No rate limits currently active</p>
          ) : (
            rateLimits.map((limit) => (
              <div 
                key={limit.id} 
                className={`p-4 border rounded-lg ${
                  isCurrentlyLocked(limit.locked_until) 
                    ? 'border-red-200 bg-red-50' 
                    : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{limit.email}</p>
                    <p className="text-sm text-muted-foreground">IP: {limit.ip_address}</p>
                    <p className="text-sm text-muted-foreground">
                      {limit.reset_attempts} attempts - Last: {formatDate(limit.last_attempt_at)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isCurrentlyLocked(limit.locked_until) ? (
                      <>
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-600">Locked</p>
                          <p className="text-xs text-red-500">
                            Until: {formatDate(limit.locked_until)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Clock className="w-5 h-5 text-yellow-600" />
                        <div className="text-right">
                          <p className="text-sm font-medium text-yellow-600">Active</p>
                          <p className="text-xs text-yellow-500">Monitoring</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Password Reset Attempts</h3>
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">IP Address</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Error Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No password reset attempts found
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-t hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(log.success)}
                          <span className={`text-sm ${
                            log.success ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {log.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{log.email}</td>
                      <td className="px-4 py-3 text-sm font-mono">{log.ip_address || 'N/A'}</td>
                      <td className="px-4 py-3">
                        {log.error_code ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                            {log.error_code}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(log.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};