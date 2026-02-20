import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Settings, BarChart3, Home, Cog, Gift } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import RoleManager from '@/components/admin/RoleManager';
import SecurityMonitor from '@/components/admin/SecurityMonitor';
import SessionManager from '@/components/admin/SessionManager';
import SystemConfigPanel from '@/components/admin/SystemConfigPanel';
import { ReferralManagement } from '@/components/admin/ReferralManagement';

const AdminPage = () => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-4">You don't have permission to access the admin panel.</p>
            <Button onClick={() => window.location.href = '/app'}>
              <Home className="w-4 h-4 mr-2" />
              Go to App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/app'}
            >
              <Home className="w-4 h-4 mr-2" />
              Back to App
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8">
          {/* Admin Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">User Management</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Manage user roles, permissions, and access control
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Analytics</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Monitor system performance and usage statistics
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Security monitoring and session management
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Referrals</CardTitle>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Configure referral rewards and track performance
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Config</CardTitle>
                <Cog className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  AI settings and N8N integration configuration
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Admin Sections with Tabs */}
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="referrals">Referrals</TabsTrigger>
              <TabsTrigger value="config">System Config</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="users" className="space-y-6">
              <RoleManager />
            </TabsContent>
            
            <TabsContent value="security" className="space-y-6">
              <SecurityMonitor />
            </TabsContent>
            
            <TabsContent value="referrals" className="space-y-6">
              <ReferralManagement />
            </TabsContent>
            
            <TabsContent value="config" className="space-y-6">
              <SystemConfigPanel />
            </TabsContent>
            
            <TabsContent value="sessions" className="space-y-6">
              <SessionManager />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;