import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePass } from '@/hooks/usePass';
import BillingManagement from '@/components/business/BillingManagement';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BillingPage = () => {
  const { user, loading } = useAuth();
  const { active, expiresAt, loading: passLoading } = usePass();
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/signin';
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading billing...</p>
        </div>
      </div>
    );
  }

  const handleGetPass = async () => {
    try {
      toast.info('Creating checkout session...');
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { tier: 'yearly' },
      });
      if (error) throw error;
      const url = data?.url as string | undefined;
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.error('Checkout is not available yet.');
      }
    } catch (e) {
      console.error('create-payment error', e);
      toast.error('Payment setup is pending. Please try again shortly.');
    }
  };

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
            <h1 className="text-xl font-bold">Billing & Subscription</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
          <div>
            <h2 className="font-semibold">Get the NotaVoice Pass</h2>
            <p className="text-sm text-muted-foreground">One-time purchase, 1 year access. No auto-renewal.</p>
          </div>
          <Button onClick={handleGetPass}>
            <CreditCard className="w-4 h-4 mr-2" /> Buy Pass
          </Button>
        </div>
        <BillingManagement />
      </div>
    </div>
  );
};

export default BillingPage;