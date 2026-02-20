import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Camera, Upload, Trash2, User } from 'lucide-react';
import { toast } from "sonner";

interface ProfileImageUploadProps {
  userId: string;
  currentAvatarUrl?: string;
  fullName?: string;
  onAvatarUpdate: (avatarUrl: string | null) => void;
}

export const ProfileImageUpload = ({ userId, currentAvatarUrl, fullName, onAvatarUpdate }: ProfileImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File) => {
    try {
      setUploading(true);

      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        });

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      onAvatarUpdate(publicUrl);
      toast.success('Profile image updated successfully');

    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      setUploading(true);

      // Update profile to remove avatar
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          avatar_url: null,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setAvatarUrl(undefined);
      onAvatarUpdate(null);
      toast.success('Profile image removed');

    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Failed to remove image');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadAvatar(file);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Avatar className="w-24 h-24 sm:w-32 sm:h-32">
              <AvatarImage src={avatarUrl} alt="Profile" />
              <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <Label className="text-sm font-medium">Profile Picture</Label>
            <p className="text-xs text-muted-foreground">
              JPG, PNG or WebP. Max 5MB.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              Upload
            </Button>
            
            {avatarUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={removeAvatar}
                disabled={uploading}
                className="flex-1 text-destructive border-destructive/20 hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </Button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
};