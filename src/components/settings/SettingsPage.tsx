import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useAuth } from '@/hooks/useAuth';

const SettingsPage = () => {
  const { user } = useAuth();
  const { settings, loading, updateSettings } = useUserSettings();
  const [saving, setSaving] = useState(false);
  

  const handleSave = async (field: string, value: any) => {
    if (!settings) return;

    setSaving(true);
    try {
      await updateSettings({ [field]: value });
      toast.success("Your preferences have been saved.");
    } catch (error) {
      toast.error("Failed to update settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/app'}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-6">
          {/* AI Processing Settings */}
          <Card>
            <CardHeader>
              <CardTitle>AI Processing</CardTitle>
              <CardDescription>Configure how your voice notes are processed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="language">Default Language</Label>
                <Select
                  value={settings?.output_language || 'en'}
                  onValueChange={(value) => handleSave('output_language', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="ko">Korean</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="style">Default AI Style</Label>
                <Select
                  value={settings?.default_ai_style || 'clean'}
                  onValueChange={(value) => handleSave('default_ai_style', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clean">Clean (Remove filler words)</SelectItem>
                    <SelectItem value="bullet">Bullet Points</SelectItem>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-transcribe">Auto Transcribe</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically transcribe audio when recording finishes
                  </p>
                </div>
                <Switch
                  id="auto-transcribe"
                  checked={settings?.auto_transcribe ?? true}
                  onCheckedChange={(checked) => handleSave('auto_transcribe', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-enhance">Auto Enhance</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically apply AI enhancement after transcription
                  </p>
                </div>
                <Switch
                  id="auto-enhance"
                  checked={settings?.auto_enhance ?? true}
                  onCheckedChange={(checked) => handleSave('auto_enhance', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Use dark theme as default
                  </p>
                </div>
                <Switch
                  id="dark-mode"
                  checked={settings?.dark_mode_preference ?? false}
                  onCheckedChange={(checked) => handleSave('dark_mode_preference', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email</Label>
                <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
              </div>
              <div>
                <Label>User ID</Label>
                <p className="text-sm text-muted-foreground mt-1">{user?.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;