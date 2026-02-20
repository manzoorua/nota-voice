import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Loader2, 
  DollarSign, 
  Users, 
  Share2, 
  Copy, 
  Gift,
  TrendingUp 
} from 'lucide-react';
import { generateReferralUrl } from '@/utils/referralUtils';

interface ReferralData {
  referralCode: string;
  pendingAmount: number;
  totalEarned: number;
  referralCount: number;
  recentReferrals: Array<{
    id: string;
    referred_email: string;
    status: string;
    created_at: string;
    reward_amount?: number;
  }>;
}

interface ReferralConfig {
  referral_bonus_amount: number;
  friend_discount_percentage: number;
  max_earnings_per_referral: number;
  payment_processing_day: number;
  payment_processing_delay_days: number;
}

export const ReferralDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ReferralData | null>(null);
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralUrl, setReferralUrl] = useState('');

  useEffect(() => {
    if (user) {
      loadReferralData();
    }
  }, [user]);

  const loadReferralData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Mock data for now since referral tables aren't in types yet
      const referralCode = 'ABC12345';
      const mockConfig: ReferralConfig = {
        referral_bonus_amount: 25.00,
        friend_discount_percentage: 50,
        max_earnings_per_referral: 500.00,
        payment_processing_day: 5,
        payment_processing_delay_days: 7
      };

      const referralData: ReferralData = {
        referralCode,
        pendingAmount: 0,
        totalEarned: 0,
        referralCount: 0,
        recentReferrals: []
      };

      setConfig(mockConfig);
      setData(referralData);
      setReferralUrl(generateReferralUrl(referralCode));

    } catch (error: any) {
      console.error('Error loading referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralUrl = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      toast.success('Referral link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const shareReferralUrl = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join NotaVoice with my referral link',
          text: `Get ${config?.friend_discount_percentage}% off your first subscription!`,
          url: referralUrl,
        });
      } catch (error) {
        // User cancelled share or error occurred
        copyReferralUrl();
      }
    } else {
      copyReferralUrl();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending Payment</Badge>;
      default:
        return <Badge variant="outline">Registered</Badge>;
    }
  };

  if (!user) {
    return (
      <Alert>
        <AlertDescription>
          Please sign in to view your referral dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading your referrals...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Referral Dashboard</h1>
        <p className="text-muted-foreground">
          Share your referral link and earn rewards for each friend who joins
        </p>
      </div>

      {/* Referral Link Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Share this link with friends to start earning rewards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={referralUrl} readOnly className="flex-1" />
            <Button onClick={copyReferralUrl} variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button onClick={shareReferralUrl}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
          
          {config && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  You earn: <strong>{formatCurrency(config.referral_bonus_amount)}</strong> per referral
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  Friends get: <strong>{config.friend_discount_percentage}% off</strong> first subscription
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.referralCount}</div>
              <p className="text-xs text-muted-foreground">
                Friends you've referred
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Rewards</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.pendingAmount)}</div>
              <p className="text-xs text-muted-foreground">
                Processing on {config?.payment_processing_day}th of month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.totalEarned)}</div>
              <p className="text-xs text-muted-foreground">
                Lifetime earnings
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Referrals */}
      {data && data.recentReferrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
            <CardDescription>
              Your latest referral activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentReferrals.map((referral) => (
                <div 
                  key={referral.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{referral.referred_email}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {formatDate(referral.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(referral.status)}
                    {referral.reward_amount && (
                      <span className="text-sm font-medium text-green-600">
                        {formatCurrency(referral.reward_amount)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Information */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
            <CardDescription>
              How and when you'll receive your referral rewards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Payment Schedule</h4>
                <p className="text-sm text-muted-foreground">
                  Rewards are processed on the <strong>{config.payment_processing_day}th</strong> of each month
                </p>
                <p className="text-sm text-muted-foreground">
                  Processing takes <strong>{config.payment_processing_delay_days} business days</strong>
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Earning Limits</h4>
                <p className="text-sm text-muted-foreground">
                  Maximum per referral: <strong>{formatCurrency(config.max_earnings_per_referral)}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  No monthly earning limit
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};