import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const PaymentSuccess = () => {
  const [verifying, setVerifying] = useState(true);
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) {
      setVerifying(false);
      setOk(false);
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { session_id: sessionId },
        });
        if (error) throw error;
        if (data?.activePass) {
          setOk(true);
          window.dispatchEvent(new Event('pass-updated'));
          toast.success('Pass activated!');
        } else {
          setOk(false);
        }
      } catch (e) {
        console.error('verify-payment error', e);
        toast.error('Could not verify payment yet. Please try refreshing in a moment.');
        setOk(false);
      } finally {
        setVerifying(false);
      }
    };

    verify();
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new CustomEvent('navigate', { detail: { path } }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-2xl text-center">
        {verifying ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Verifying your payment...</p>
          </div>
        ) : ok ? (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-12 h-12 text-primary" />
            <h1 className="text-2xl font-bold">Payment successful</h1>
            <p className="text-muted-foreground">Your NotaVoice Pass is now active.</p>
            <div className="flex gap-3 justify-center mt-4">
              <Button onClick={() => navigate('/app')}>Start creating</Button>
              <Button variant="outline" onClick={() => navigate('/billing')}>Manage billing</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-bold">We couldn't verify your payment</h1>
            <p className="text-muted-foreground">If you completed checkout, this may resolve shortly. You can retry in a few seconds.</p>
            <div className="flex gap-3 justify-center mt-4">
              <Button onClick={() => window.location.reload()}>Retry verification</Button>
              <Button variant="outline" onClick={() => navigate('/pricing')}>See pricing</Button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PaymentSuccess;
