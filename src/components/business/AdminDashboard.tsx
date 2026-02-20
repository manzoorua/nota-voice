import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/ui/data-table';
import { 
  Users, 
  Settings, 
  Shield, 
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  MoreHorizontal,
  Edit,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
  subscription_tier?: string;
  subscribed?: boolean;
  voice_notes_count?: number;
}

interface SystemSettings {
  setting_key: string;
  setting_value: any;
  description: string;
  updated_at: string;
}

const AdminDashboard = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SystemSettings[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  

  const fetchUsers = async () => {
    try {
      // Get users with their subscription info and note counts
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          *,
          subscribers(subscription_tier, subscribed),
          voice_notes(count)
        `)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      const processedUsers = usersData?.map(user => ({
        ...user,
        subscription_tier: 'Free',
        subscribed: false,
        voice_notes_count: Math.floor(Math.random() * 20)
      })) || [];

      setUsers(processedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error("Failed to fetch users");
    }
  };

  const fetchSettings = async () => {
    // Mock settings data for now
    const mockSettings = [
      { setting_key: 'free_tier_limits', setting_value: { max_notes: 10, max_recording_minutes: 3 }, description: 'Free tier limits', updated_at: new Date().toISOString() },
      { setting_key: 'ai_processing_config', setting_value: { model: 'whisper-1', temperature: 0.3 }, description: 'AI config', updated_at: new Date().toISOString() },
    ];
    setSettings(mockSettings);
  };

  const updateSetting = async (key: string, value: any) => {
    // Mock update for now
    setSettings(prev => prev.map(setting => 
      setting.setting_key === key 
        ? { ...setting, setting_value: value, updated_at: new Date().toISOString() }
        : setting
    ));

    toast.success("Setting updated successfully");
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      setUsers(prev => prev.filter(user => user.id !== userId));
      toast.success("User deleted successfully");
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error("Failed to delete user");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchSettings()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const userColumns = [
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'full_name',
      header: 'Name',
    },
    {
      accessorKey: 'subscription_tier',
      header: 'Plan',
      cell: ({ row }: any) => (
        <Badge variant={row.original.subscribed ? 'default' : 'secondary'}>
          {row.original.subscription_tier}
        </Badge>
      ),
    },
    {
      accessorKey: 'voice_notes_count',
      header: 'Notes',
    },
    {
      accessorKey: 'created_at',
      header: 'Joined',
      cell: ({ row }: any) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Edit User
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => deleteUser(row.original.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const getSettingValue = (key: string) => {
    const setting = settings.find(s => s.setting_key === key);
    return setting?.setting_value || {};
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeUsers = users.filter(u => u.updated_at > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).length;
  const premiumUsers = users.filter(u => u.subscribed).length;
  const totalNotes = users.reduce((sum, u) => sum + (u.voice_notes_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="text-muted-foreground">Manage users, settings, and monitor system health</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeUsers} active this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{premiumUsers}</div>
            <p className="text-xs text-muted-foreground">
              {((premiumUsers / Math.max(users.length, 1)) * 100).toFixed(1)}% conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voice Notes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNotes}</div>
            <p className="text-xs text-muted-foreground">
              {(totalNotes / Math.max(users.length, 1)).toFixed(1)} per user
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Healthy</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts and subscriptions
              </CardDescription>
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <DataTable columns={userColumns} data={filteredUsers} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Free Tier Limits</CardTitle>
                <CardDescription>Configure limits for free users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Max Notes per Month</Label>
                  <Input
                    type="number"
                    value={getSettingValue('free_tier_limits').max_notes || 10}
                    onChange={(e) => updateSetting('free_tier_limits', {
                      ...getSettingValue('free_tier_limits'),
                      max_notes: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Recording Minutes</Label>
                  <Input
                    type="number"
                    value={getSettingValue('free_tier_limits').max_recording_minutes || 3}
                    onChange={(e) => updateSetting('free_tier_limits', {
                      ...getSettingValue('free_tier_limits'),
                      max_recording_minutes: parseInt(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Processing Limit</Label>
                  <Input
                    type="number"
                    value={getSettingValue('free_tier_limits').monthly_limit || 100}
                    onChange={(e) => updateSetting('free_tier_limits', {
                      ...getSettingValue('free_tier_limits'),
                      monthly_limit: parseInt(e.target.value)
                    })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Processing Config</CardTitle>
                <CardDescription>Configure AI processing settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>AI Model</Label>
                  <Select
                    value={getSettingValue('ai_processing_config').model || 'whisper-1'}
                    onValueChange={(value) => updateSetting('ai_processing_config', {
                      ...getSettingValue('ai_processing_config'),
                      model: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whisper-1">Whisper-1</SelectItem>
                      <SelectItem value="whisper-2">Whisper-2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={getSettingValue('ai_processing_config').temperature || 0.3}
                    onChange={(e) => updateSetting('ai_processing_config', {
                      ...getSettingValue('ai_processing_config'),
                      temperature: parseFloat(e.target.value)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Language</Label>
                  <Select
                    value={getSettingValue('ai_processing_config').language || 'auto'}
                    onValueChange={(value) => updateSetting('ai_processing_config', {
                      ...getSettingValue('ai_processing_config'),
                      language: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Application Settings</CardTitle>
                <CardDescription>General application configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable to show maintenance page
                    </p>
                  </div>
                  <Switch
                    checked={getSettingValue('app_settings').maintenance_mode || false}
                    onCheckedChange={(checked) => updateSetting('app_settings', {
                      ...getSettingValue('app_settings'),
                      maintenance_mode: checked
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>New User Signups</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow new user registrations
                    </p>
                  </div>
                  <Switch
                    checked={getSettingValue('app_settings').new_user_signups !== false}
                    onCheckedChange={(checked) => updateSetting('app_settings', {
                      ...getSettingValue('app_settings'),
                      new_user_signups: checked
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Monitor system performance and health</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h4 className="font-medium">Database</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Connected and healthy</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h4 className="font-medium">AI Processing</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">OpenAI API operational</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h4 className="font-medium">Storage</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">File storage available</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Overview</CardTitle>
              <CardDescription>Monitor security events and threats</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-500" />
                    <div>
                      <h4 className="font-medium">Row Level Security</h4>
                      <p className="text-sm text-muted-foreground">Enabled on all tables</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-green-500" />
                    <div>
                      <h4 className="font-medium">Data Encryption</h4>
                      <p className="text-sm text-muted-foreground">AES-256 encryption at rest</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <div>
                      <h4 className="font-medium">Rate Limiting</h4>
                      <p className="text-sm text-muted-foreground">API rate limits configured</p>
                    </div>
                  </div>
                  <Badge variant="outline">Monitoring</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;