import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Download, MessageCircle, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

interface AccountCardProps {
  email: string;
  onExportNotes: () => void;
}

export const AccountCard = ({ email, onExportNotes }: AccountCardProps) => {
  const handleFeedback = () => {
    window.open('mailto:support@notavoice.com?subject=Feedback&body=Hi! I have some feedback about NotaVoice...', '_blank');
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="w-5 h-5 text-primary" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Display */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Contact Email Address
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            readOnly
            className="bg-muted border-border"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={onExportNotes}
            variant="outline"
            className="w-full justify-start"
          >
            <Download className="w-4 h-4 mr-2" />
            export notes
          </Button>
          
          <Button
            onClick={handleFeedback}
            variant="outline"
            className="w-full justify-start"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            got feedback?
          </Button>
          
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full justify-start text-destructive border-destructive/20 hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            log out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};