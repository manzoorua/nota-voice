import * as React from "react";
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Building, Calendar, Crown, Shield } from 'lucide-react';

const UserProfile: React.FC = () => {
  const { user, profile, signOut, isAdmin, isPremium } = useAuth();

  if (!user || !profile) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading profile...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your account details and preferences
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Admin
              </Badge>
            )}
            {isPremium && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Premium
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{profile.full_name || 'Not provided'}</p>
              <p className="text-sm text-muted-foreground">Full Name</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{user.email}</p>
              <p className="text-sm text-muted-foreground">Email Address</p>
            </div>
          </div>

          {profile.company && (
            <div className="flex items-center gap-3">
              <Building className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{profile.company}</p>
                <p className="text-sm text-muted-foreground">Company</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {new Date(profile.created_at || '').toLocaleDateString()}
              </p>
              <p className="text-sm text-muted-foreground">Member Since</p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Account Status</p>
              <p className="text-sm text-muted-foreground">
                {profile.subscription_status || 'free'}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => signOut()}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserProfile;