import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Send, RefreshCw, HelpCircle, MessageCircle } from 'lucide-react';
import { toast } from "sonner";

interface TroubleshootingCardProps {
  onRetryTranscription?: () => void;
}

export const TroubleshootingCard = ({ onRetryTranscription }: TroubleshootingCardProps) => {
  const [supportQuery, setSupportQuery] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendSupport = async () => {
    if (!supportQuery.trim()) {
      toast.error('Please enter your question or issue');
      return;
    }

    setSending(true);
    try {
      // Simulate support form submission - in real app, this would send to support system
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For now, open email with pre-filled support query
      const subject = encodeURIComponent('Support Request');
      const body = encodeURIComponent(`Issue: ${supportQuery}\n\nPlease describe your issue in detail.`);
      window.open(`mailto:support@notavoice.com?subject=${subject}&body=${body}`, '_blank');
      
      setSupportQuery('');
      toast.success('Support request submitted');
    } catch (error) {
      toast.error('Failed to submit request');
    } finally {
      setSending(false);
    }
  };

  const handleFeedback = () => {
    window.open('mailto:support@notavoice.com?subject=Feedback&body=Hi! I have some feedback about NotaVoice...', '_blank');
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="w-1 h-6 bg-amber-500 rounded-full" />
          Troubleshoot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* General Support Section */}
        <div className="space-y-3">
          <Label htmlFor="support-query" className="text-sm font-medium">
            Is something not working the way it should?
          </Label>
          <div className="flex gap-2">
            <Input
              id="support-query"
              value={supportQuery}
              onChange={(e) => setSupportQuery(e.target.value)}
              placeholder="Describe your issue..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendSupport();
                }
              }}
            />
            <Button
              onClick={handleSendSupport}
              disabled={sending || !supportQuery.trim()}
              size="sm"
              className="px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Recording Failure Section - Dark Theme */}
        <div className="bg-secondary text-secondary-foreground rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-medium">Did your last recording fail?</p>
          </div>
          <p className="text-xs opacity-80">
            Try refreshing the page or check your microphone permissions
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryTranscription}
              className="flex-1 bg-background text-foreground border-border hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Transcription
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="flex-1 bg-background text-foreground border-border hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
          </div>
        </div>

        {/* Quick Help Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.href = '/help'}
            className="justify-start"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Help Center
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleFeedback}
            className="justify-start"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};