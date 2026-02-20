import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Shield, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'user' | 'guest';
  created_at: string;
}

const RoleManager = () => {
  const { user: currentUser, isAdmin, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchUsersAndRoles();
    }
  }, [isAdmin]);

  const fetchUsersAndRoles = async () => {
    try {
      // Fetch users from profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles = profilesData?.map(profile => {
        const userRole = rolesData?.find(role => role.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || 'user'
        };
      }) || [];

      setUsers(usersWithRoles);
      setUserRoles(rolesData || []);
    } catch (error) {
      console.error('Error fetching users and roles:', error);
      toast.error('Failed to load users and roles');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string, reason?: string) => {
    // SECURITY FIX: Remove all client-side validation
    // All validation and security checks are handled server-side by secure_change_user_role function
    
    // Only prompt for reason if assigning high-privilege roles
    if (['admin', 'system_admin'].includes(newRole)) {
      const detailedReason = prompt(
        `⚠️ SECURITY ALERT ⚠️\n\nYou are about to grant ${newRole} privileges.\n\nPlease provide a detailed justification for this role assignment.\n\nThis action will be logged and audited for security compliance.`,
        reason || ''
      );
      
      if (!detailedReason) {
        toast.error("Role assignment cancelled");
        return;
      }
      
      reason = detailedReason;
    }

    try {
      const { data, error } = await supabase.functions.invoke('secure-role-change', {
        body: {
          targetUserId: userId,
          newRole,
          reason: reason || `Role changed to ${newRole}`
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message || "Role updated successfully");
        
        // Log successful role change
        console.log('Role change completed:', {
          targetUser: userId,
          newRole,
          timestamp: new Date().toISOString()
        });
        
        fetchUsersAndRoles();
      } else {
        toast.error(data.error || "Failed to update role");
        
        // Log failed attempt
        console.warn('Role change failed:', {
          targetUser: userId,
          attemptedRole: newRole,
          error: data.error
        });
      }
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error("Failed to update user role. Please check your permissions.");
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'moderator': return 'default';
      case 'user': return 'secondary';
      case 'guest': return 'outline';
      default: return 'secondary';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'moderator': return <UserCheck className="w-4 h-4" />;
      case 'user': return <Users className="w-4 h-4" />;
      case 'guest': return <UserX className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">You don't have permission to manage user roles.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading users...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          User Role Management
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage user roles and permissions for your organization
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getRoleIcon(user.role || 'user')}
                <div>
                  <p className="font-medium">{user.full_name || user.email}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={getRoleBadgeVariant(user.role || 'user')}>
                  {(user.role || 'user').charAt(0).toUpperCase() + (user.role || 'user').slice(1)}
                </Badge>

                {user.id !== currentUser?.id && (
                  <Select
                    value={user.role || 'user'}
                    onValueChange={(newRole) => updateUserRole(user.id, newRole)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guest">Guest</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {user.id === currentUser?.id && (
                  <Badge variant="outline" className="text-xs">
                    You
                  </Badge>
                )}
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Role Descriptions:</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <strong>Admin:</strong> Full system access and user management
            </div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              <strong>Moderator:</strong> Content moderation and limited admin features
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <strong>User:</strong> Standard app features and personal data access
            </div>
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4" />
              <strong>Guest:</strong> Limited read-only access
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoleManager;