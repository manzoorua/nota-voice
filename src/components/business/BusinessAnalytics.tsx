import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Mic, 
  Clock,
  Download,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnalyticsData {
  total_users: number;
  active_users: number;
  premium_users: number;
  total_voice_notes: number;
  total_processing_time: number;
  revenue_summary: {
    mrr: number;
    arr: number;
  };
}

interface ChartData {
  date: string;
  users: number;
  notes: number;
  revenue: number;
}

const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B'];

const BusinessAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  

  const fetchAnalytics = async () => {
    try {
      // Mock analytics data for now
      const mockData = {
        total_users: 150,
        active_users: 45,
        premium_users: 12,
        total_voice_notes: 1250,
        total_processing_time: 2500,
        revenue_summary: { mrr: 119.88, arr: 1438.56 }
      };
      setAnalyticsData(mockData);

      // Mock chart data
      const mockChartData = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        users: Math.floor(Math.random() * 20) + 10,
        notes: Math.floor(Math.random() * 50) + 20,
        revenue: Math.floor(Math.random() * 100) + 50
      }));

      setChartData(mockChartData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error("Failed to fetch analytics data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshAnalytics = async () => {
    setRefreshing(true);
    await fetchAnalytics();
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const exportData = () => {
    if (!analyticsData) return;
    
    const data = {
      summary: analyticsData,
      historical: chartData,
      exported_at: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notavoice-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Analytics data has been exported to JSON file");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-1"></div>
                <div className="h-3 bg-muted rounded w-32"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const conversionRate = analyticsData ? 
    (analyticsData.premium_users / Math.max(analyticsData.total_users, 1) * 100) : 0;

  const avgProcessingTime = analyticsData ? 
    (analyticsData.total_processing_time / Math.max(analyticsData.total_voice_notes, 1)) : 0;

  const pieData = [
    { name: 'Free Users', value: analyticsData ? analyticsData.total_users - analyticsData.premium_users : 0 },
    { name: 'Premium Users', value: analyticsData?.premium_users || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Business Analytics</h2>
          <p className="text-muted-foreground">Monitor your NotaVoice business performance</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={refreshAnalytics} 
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={exportData}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.total_users || 0}</div>
            <p className="text-xs text-muted-foreground">
              {analyticsData?.active_users || 0} active this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analyticsData?.revenue_summary?.mrr?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              ${analyticsData?.revenue_summary?.arr?.toFixed(2) || '0.00'} ARR
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voice Notes</CardTitle>
            <Mic className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.total_voice_notes || 0}</div>
            <p className="text-xs text-muted-foreground">
              {avgProcessingTime.toFixed(1)}s avg processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
            <Progress value={conversionRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>Daily active users over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="users" 
                      stroke="#8B5CF6" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Distribution</CardTitle>
                <CardDescription>Free vs Premium users</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Analytics</CardTitle>
              <CardDescription>Detailed user metrics and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="users" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">MRR</span>
                    <Badge variant="secondary">
                      ${analyticsData?.revenue_summary?.mrr?.toFixed(2) || '0.00'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">ARR</span>
                    <Badge variant="secondary">
                      ${analyticsData?.revenue_summary?.arr?.toFixed(2) || '0.00'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">ARPU</span>
                    <Badge variant="secondary">
                      ${analyticsData ? 
                        (analyticsData.revenue_summary.mrr / Math.max(analyticsData.premium_users, 1)).toFixed(2) : 
                        '0.00'
                      }
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Daily revenue from subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#10B981" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Patterns</CardTitle>
              <CardDescription>Voice notes creation over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="notes" fill="#06B6D4" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Key Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <h4 className="font-medium text-primary">Conversion Opportunity</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {analyticsData ? analyticsData.total_users - analyticsData.premium_users : 0} free users 
                could potentially convert to premium
              </p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
              <h4 className="font-medium text-green-700 dark:text-green-300">Processing Efficiency</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Average processing time: {avgProcessingTime.toFixed(1)} seconds per note
              </p>
            </div>
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <h4 className="font-medium text-blue-700 dark:text-blue-300">User Engagement</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {analyticsData ? 
                  ((analyticsData.active_users / Math.max(analyticsData.total_users, 1)) * 100).toFixed(1) :
                  '0'
                }% of users were active this month
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessAnalytics;