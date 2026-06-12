import { useState, useEffect } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Crown, BarChart3, Users, Zap } from 'lucide-react';
import { toast } from "sonner";
import { ProfileImageUpload } from '@/components/profile/ProfileImageUpload';
import { AccountCard } from '@/components/profile/AccountCard';
import { TroubleshootingCard } from '@/components/profile/TroubleshootingCard';
import { QueueStatusPanel } from '@/lib/offline-queue/react';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [noteCount, setNoteCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();

  useEffect(() => {
    // Check authentication status
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        window.location.href = '/signin';
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        window.location.href = '/signin';
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      if (user) {
        // First try to get profile from database
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        const profileData = {
          id: user.id,
          email: user.email || '',
          full_name: dbProfile?.full_name || user.user_metadata?.full_name || '',
          avatar_url: dbProfile?.avatar_url || undefined,
          created_at: user.created_at || new Date().toISOString()
        };
        
        setProfile(profileData);
        setFullName(profileData.full_name);
        setAvatarUrl(profileData.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { count, error } = await supabase
        .from('voice_notes')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      setNoteCount(count || 0);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const updateProfile = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      // Update profile in database
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          email: user.email || '',
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Profile updated successfully');
      if (profile) {
        setProfile({ ...profile, full_name: fullName });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpdate = (newAvatarUrl: string | null) => {
    setAvatarUrl(newAvatarUrl || undefined);
    if (profile) {
      setProfile({ ...profile, avatar_url: newAvatarUrl || undefined });
    }
  };

  const retryTranscription = async () => {
    try {
      // Get the latest failed voice note
      const { data: failedNotes, error } = await supabase
        .from('voice_notes')
        .select('*')
        .eq('user_id', user?.id)
        .or('transcription.is.null,enhanced_content.is.null')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (failedNotes && failedNotes.length > 0) {
        // Here you would trigger the transcription retry
        // For now, just show a success message
        toast.success('Retry transcription initiated');
      } else {
        toast.error('No failed recordings found');
      }
    } catch (error) {
      console.error('Error retrying transcription:', error);
      toast.error('Failed to retry transcription');
    }
  };

  const exportNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('voice_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const dataStr = JSON.stringify(data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `voice-notes-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast.success('Notes exported successfully');
    } catch (error) {
      console.error('Error exporting notes:', error);
      toast.error('Failed to export notes');
    }
  };


  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/app'}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Back to App</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Profile</h1>
        </div>

        {/* Mobile-first responsive grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 max-w-6xl mx-auto">
          
          {/* Profile Image Upload */}
          <ProfileImageUpload
            userId={user?.id || ''}
            currentAvatarUrl={avatarUrl}
            fullName={profile?.full_name}
            onAvatarUpdate={handleAvatarUpdate}
          />

          {/* Account Card */}
          <AccountCard
            email={profile?.email || ''}
            onExportNotes={exportNotes}
          />

          {/* Account Summary Card */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-primary" />
                Account Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{profile?.full_name || 'User'}</p>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Free Plan
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{noteCount}</div>
                  <div className="text-xs text-muted-foreground">Total Notes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {profile ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '--'}
                  </div>
                  <div className="text-xs text-muted-foreground">Member Since</div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Plan Information Card - Dark Theme */}
          <Card className="bg-secondary text-secondary-foreground border-secondary">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Crown className="w-5 h-5 text-yellow-500" />
                Free Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Notes this month</span>
                  <span className="font-medium">{noteCount}/10</span>
                </div>
                <div className="w-full bg-secondary-foreground/20 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-primary to-yellow-500 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.min((noteCount / 10) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Recording limit</span>
                  <span className="font-medium">3 minutes</span>
                </div>
              </div>
              
              <Button 
                className="w-full bg-gradient-to-r from-primary to-yellow-500 hover:from-primary/90 hover:to-yellow-500/90 text-white border-0"
                onClick={() => window.location.href = '/#pricing'}
              >
                <Zap className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            </CardContent>
          </Card>

          {/* Profile Settings Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Profile Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="mt-1 bg-muted"
                />
              </div>
              <Button onClick={updateProfile} disabled={isSaving} className="w-full">
                {isSaving ? 'Saving...' : 'Update Profile'}
              </Button>
            </CardContent>
          </Card>

          {/* Troubleshooting Card */}
          <TroubleshootingCard onRetryTranscription={retryTranscription} />

          {/* Offline queue status — surfaces pending/failed offline operations
              and lets the user retry or discard failed items (Req 8.1, 8.3). */}
          <div className="lg:col-span-2">
            <QueueStatusPanel />
          </div>

          {/* Referral Program Card */}
          <Card className="lg:col-span-2 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border-primary/20">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-primary" />
                Referral Program
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-base mb-1">Invite friends and earn rewards</p>
                  <p className="text-sm text-muted-foreground">
                    Share your referral link and get benefits when others join
                  </p>
                </div>
                <Button
                  onClick={() => window.location.href = '/referrals'}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap"
                >
                  <Users className="w-4 h-4 mr-2" />
                  View Referrals
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Management Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Account Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/privacy'}
                  className="justify-start"
                >
                  Privacy Policy
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/terms'}
                  className="justify-start"
                >
                  Terms of Service
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;