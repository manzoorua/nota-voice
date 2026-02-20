import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, DollarSign, Users, TrendingUp, Settings } from 'lucide-react';

interface ReferralConfig {
  id: string;
  referral_bonus_amount: number;
  friend_discount_percentage: number;
  max_earnings_per_referral: number;
  max_total_earnings: number;
  payment_processing_day: number;
  payment_processing_delay_days: number;
  is_active: boolean;
}

interface ReferralStats {
  totalReferrals: number;
  totalEarnings: number;
  pendingPayouts: number;
  activeReferrers: number;
  conversionRate: number;
  averageReferralValue: number;
  growthRate: number;
}

export const ReferralManagement: React.FC = () => {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load configuration from database
      const { data: configData, error: configError } = await supabase
        .rpc('get_active_referral_configuration');

      if (configError) throw configError;

      if (configData && configData.length > 0) {
        setConfig(configData[0] as ReferralConfig);
      }

      // Load stats using existing function
      const { data: statsData } = await supabase
        .rpc('get_admin_referral_stats');

      if (statsData) {
        // Type guard to ensure we have the right structure
        const typedStats = statsData as unknown as ReferralStats;
        setStats(typedStats);
      }

    } catch (error: any) {
      console.error('Error loading referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('referral_configuration')
        .update({
          referral_bonus_amount: config.referral_bonus_amount,
          friend_discount_percentage: config.friend_discount_percentage,
          max_earnings_per_referral: config.max_earnings_per_referral,
          max_total_earnings: config.max_total_earnings,
          payment_processing_day: config.payment_processing_day,
          payment_processing_delay_days: config.payment_processing_delay_days,
          is_active: config.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);

      if (error) throw error;

      toast.success('Referral configuration updated successfully');
      setEditMode(false);
      loadData(); // Refresh data
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (!isAdmin) {
    return (
      <Alert>
        <AlertDescription>
          You need admin privileges to access referral management.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading referral management...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Referral Management</h1>
          <p className="text-muted-foreground">Configure and monitor the referral system</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReferrals}</div>
              <p className="text-xs text-muted-foreground">
                {stats.growthRate > 0 ? '+' : ''}{stats.growthRate}% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalEarnings)}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {formatCurrency(stats.averageReferralValue)} per referral
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.pendingPayouts)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeReferrers} active referrers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">
                Signups to paid conversions
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Configuration Panel */}
      {config && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Referral Configuration</CardTitle>
                <CardDescription>
                  Manage referral rewards and settings
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {editMode ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveConfig}
                      disabled={saving}
                    >
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setEditMode(true)}>
                    Edit Configuration
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="referral_bonus">Referral Bonus Amount</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">$</span>
                    <Input
                      id="referral_bonus"
                      type="number"
                      step="0.01"
                      value={config.referral_bonus_amount}
                      onChange={(e) => setConfig({
                        ...config,
                        referral_bonus_amount: parseFloat(e.target.value) || 0
                      })}
                      disabled={!editMode}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Amount paid to referrer for each successful referral
                  </p>
                </div>

                <div>
                  <Label htmlFor="friend_discount">Friend Discount Percentage</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="friend_discount"
                      type="number"
                      min="0"
                      max="100"
                      value={config.friend_discount_percentage}
                      onChange={(e) => setConfig({
                        ...config,
                        friend_discount_percentage: parseInt(e.target.value) || 0
                      })}
                      disabled={!editMode}
                    />
                    <span className="text-lg">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Discount applied to referred friend's first subscription
                  </p>
                </div>

                <div>
                  <Label htmlFor="max_earnings">Max Earnings Per Referral</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">$</span>
                    <Input
                      id="max_earnings"
                      type="number"
                      step="0.01"
                      value={config.max_earnings_per_referral}
                      onChange={(e) => setConfig({
                        ...config,
                        max_earnings_per_referral: parseFloat(e.target.value) || 0
                      })}
                      disabled={!editMode}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="max_total">Max Total Earnings</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">$</span>
                    <Input
                      id="max_total"
                      type="number"
                      step="0.01"
                      value={config.max_total_earnings}
                      onChange={(e) => setConfig({
                        ...config,
                        max_total_earnings: parseFloat(e.target.value) || 0
                      })}
                      disabled={!editMode}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="processing_day">Payment Processing Day</Label>
                  <Input
                    id="processing_day"
                    type="number"
                    min="1"
                    max="28"
                    value={config.payment_processing_day}
                    onChange={(e) => setConfig({
                      ...config,
                      payment_processing_day: parseInt(e.target.value) || 5
                    })}
                    disabled={!editMode}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Day of month to process payments (1-28)
                  </p>
                </div>

                <div>
                  <Label htmlFor="processing_delay">Payment Delay Days</Label>
                  <Input
                    id="processing_delay"
                    type="number"
                    min="0"
                    max="30"
                    value={config.payment_processing_delay_days}
                    onChange={(e) => setConfig({
                      ...config,
                      payment_processing_delay_days: parseInt(e.target.value) || 7
                    })}
                    disabled={!editMode}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Business days delay for payment processing
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center space-x-2">
              <Badge variant={config.is_active ? "default" : "secondary"}>
                {config.is_active ? "Active" : "Inactive"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Referral system is currently {config.is_active ? "enabled" : "disabled"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};