import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  CreditCard, 
  Calendar, 
  Download, 
  Star,
  Crown,
  Check,
  Zap,
  Clock,
  TrendingUp
} from 'lucide-react';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string;
}

interface UsageData {
  current_month_notes: number;
  current_month_minutes: number;
  total_notes: number;
  total_minutes: number;
}

const BillingManagement = () => {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const { user } = useAuth();
  // const { toast } = useToast(); // Using sonner instead

  const checkSubscription = async () => {
    setCheckingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      
      setSubscriptionData(data);
      toast.success("Subscription status has been refreshed");
    } catch (error) {
      console.error('Error checking subscription:', error);
      toast.error("Failed to check subscription status");
    } finally {
      setCheckingSubscription(false);
    }
  };

  const createCheckout = async () => {
    setCreatingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      if (error) throw error;
      
      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error("Failed to create checkout session");
    } finally {
      setCreatingCheckout(false);
    }
  };

  const manageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      
      // Open Stripe Customer Portal in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error("Failed to open subscription management");
    }
  };

  const fetchUsageData = async () => {
    if (!user) return;

    try {
      const currentMonth = new Date();
      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

      // Fetch current month usage
      const { data: monthlyNotes, error: monthlyError } = await supabase
        .from('voice_notes')
        .select('id, processing_time_seconds')
        .eq('user_id', user.id)
        .gte('created_at', firstDayOfMonth.toISOString());

      if (monthlyError) throw monthlyError;

      // Fetch total usage
      const { data: totalNotes, error: totalError } = await supabase
        .from('voice_notes')
        .select('id, processing_time_seconds')
        .eq('user_id', user.id);

      if (totalError) throw totalError;

      const currentMonthMinutes = (monthlyNotes?.length || 0) * 2; // Estimate 2 min per note
      const totalMinutes = (totalNotes?.length || 0) * 2; // Estimate 2 min per note

      setUsageData({
        current_month_notes: monthlyNotes?.length || 0,
        current_month_minutes: currentMonthMinutes,
        total_notes: totalNotes?.length || 0,
        total_minutes: totalMinutes,
      });
    } catch (error) {
      console.error('Error fetching usage data:', error);
    }
  };

  const fetchSubscriptionData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('subscribers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      setSubscriptionData(data || { subscribed: false });
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscriptionData({ subscribed: false });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchSubscriptionData(), fetchUsageData()]);
      setLoading(false);
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isSubscribed = subscriptionData?.subscribed || false;
  const subscriptionTier = subscriptionData?.subscription_tier || 'Free';
  const subscriptionEnd = subscriptionData?.subscription_end;

  // Calculate usage percentages for free tier
  const freeNotesLimit = 10;
  const freeMinutesLimit = 30; // 10 notes × 3 minutes each
  const notesUsagePercent = Math.min((usageData?.current_month_notes || 0) / freeNotesLimit * 100, 100);
  const minutesUsagePercent = Math.min((usageData?.current_month_minutes || 0) / freeMinutesLimit * 100, 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Billing & Subscription</h2>
          <p className="text-muted-foreground">Manage your NotaVoice subscription and billing</p>
        </div>
        <Button 
          variant="outline" 
          onClick={checkSubscription}
          disabled={checkingSubscription}
          className="flex items-center gap-2"
        >
          <TrendingUp className={`w-4 h-4 ${checkingSubscription ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isSubscribed ? (
                <Crown className="w-5 h-5 text-yellow-500" />
              ) : (
                <Star className="w-5 h-5 text-gray-500" />
              )}
              Current Plan
            </CardTitle>
            <CardDescription>
              Your current subscription and benefits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{subscriptionTier}</span>
              <Badge variant={isSubscribed ? "default" : "secondary"}>
                {isSubscribed ? "Active" : "Free"}
              </Badge>
            </div>

            {isSubscribed && subscriptionEnd && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Next billing date</span>
                <span>{new Date(subscriptionEnd).toLocaleDateString()}</span>
              </div>
            )}

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Plan Features</h4>
              {isSubscribed ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Unlimited voice notes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">15-minute recording limit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Priority AI processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Advanced formatting options</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Email support</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">10 voice notes per month</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">3-minute recording limit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Basic AI transcription</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-50">
                    <span className="w-4 h-4 text-gray-400">✗</span>
                    <span className="text-sm">Advanced features</span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex gap-2">
              {isSubscribed ? (
                <Button 
                  onClick={manageSubscription}
                  className="flex-1"
                  variant="outline"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage Subscription
                </Button>
              ) : (
                <Button 
                  onClick={createCheckout}
                  disabled={creatingCheckout}
                  className="flex-1"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Premium
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage & Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Usage This Month
            </CardTitle>
            <CardDescription>
              Track your current month's usage and limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Voice Notes</span>
                  <span className="text-sm text-muted-foreground">
                    {usageData?.current_month_notes || 0} / {isSubscribed ? '∞' : freeNotesLimit}
                  </span>
                </div>
                {!isSubscribed && (
                  <Progress value={notesUsagePercent} className="h-2" />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Processing Time</span>
                  <span className="text-sm text-muted-foreground">
                    {(usageData?.current_month_minutes || 0).toFixed(1)} min
                    {!isSubscribed && ` / ${freeMinutesLimit} min`}
                  </span>
                </div>
                {!isSubscribed && (
                  <Progress value={minutesUsagePercent} className="h-2" />
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium">All Time Stats</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Notes</span>
                  <div className="font-medium">{usageData?.total_notes || 0}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Time</span>
                  <div className="font-medium">{(usageData?.total_minutes || 0).toFixed(1)} min</div>
                </div>
              </div>
            </div>

            {!isSubscribed && (notesUsagePercent > 80 || minutesUsagePercent > 80) && (
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800 dark:text-yellow-200">
                    Approaching Limit
                  </span>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  You're close to your monthly limit. Upgrade to Premium for unlimited usage.
                </p>
                <Button 
                  size="sm" 
                  className="mt-2"
                  onClick={createCheckout}
                  disabled={creatingCheckout}
                >
                  Upgrade Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pricing Plans */}
      {!isSubscribed && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade to Premium</CardTitle>
            <CardDescription>
              Unlock unlimited voice notes and advanced features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-lg border border-muted">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Free</h3>
                  <div className="text-3xl font-bold mb-4">$0</div>
                  <div className="space-y-2 text-sm">
                    <div>10 notes per month</div>
                    <div>3-minute recordings</div>
                    <div>Basic transcription</div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-lg border-2 border-primary bg-primary/5 relative">
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  Most Popular
                </Badge>
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Premium</h3>
                  <div className="text-3xl font-bold mb-1">$9.99</div>
                  <div className="text-sm text-muted-foreground mb-4">per month</div>
                  <div className="space-y-2 text-sm mb-6">
                    <div>Unlimited notes</div>
                    <div>15-minute recordings</div>
                    <div>Advanced AI features</div>
                    <div>Priority support</div>
                  </div>
                  <Button 
                    className="w-full"
                    onClick={createCheckout}
                    disabled={creatingCheckout}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade Now
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BillingManagement;