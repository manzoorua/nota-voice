import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';

const PaymentCanceled = () => {
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new CustomEvent('navigate', { detail: { path } }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-2xl text-center">
        <h1 className="text-2xl font-bold mb-2">Checkout canceled</h1>
        <p className="text-muted-foreground">No worries—your card wasn't charged.</p>
        <div className="flex gap-3 justify-center mt-6">
          <Button onClick={() => navigate('/pricing')}>Back to pricing</Button>
          <Button variant="outline" onClick={() => navigate('/billing')}>Go to billing</Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentCanceled;
