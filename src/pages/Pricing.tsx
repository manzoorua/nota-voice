import * as React from "react";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from '@/components/navigation/Link';
import { useAuth } from '@/hooks/useAuth';
import { Check, Crown, Zap, Star, ArrowLeft } from 'lucide-react';

const PricingPage = () => {
  const { user, isPremium, isAdmin } = useAuth();

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out NotaVoice',
      features: [
        '10 voice notes per day',
        '3 minutes per recording',
        'Basic transcription',
        'Text export',
        'Web access'
      ],
      limitations: [
        'Limited daily usage',
        'No advanced AI features',
        'Basic support'
      ],
      cta: 'Get Started Free',
      current: !isPremium && !isAdmin
    },
    {
      name: 'Premium',
      price: '$9.99',
      period: 'per month',
      description: 'For professionals and power users',
      features: [
        'Unlimited voice notes',
        '15 minutes per recording',
        'Advanced AI transcription',
        'Multiple export formats',
        'Priority processing',
        'Advanced search',
        'Cloud sync',
        'Premium support'
      ],
      limitations: [],
      cta: isPremium ? 'Current Plan' : 'Upgrade to Premium',
      popular: true,
      current: isPremium
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'pricing',
      description: 'For teams and organizations',
      features: [
        'Everything in Premium',
        'Team collaboration',
        'Admin dashboard',
        'Custom integrations',
        'SSO support',
        'Dedicated support',
        'Custom limits'
      ],
      limitations: [],
      cta: 'Contact Sales',
      current: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">Pricing Plans</h1>
          </div>
          {user && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/app'}
            >
              Back to App
            </Button>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Choose Your <span className="text-gradient">Perfect Plan</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade when you're ready for more power and features.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card key={plan.name} className={`relative ${plan.popular ? 'ring-2 ring-primary shadow-lg scale-105' : ''} ${plan.current ? 'ring-2 ring-green-500' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                  <Star className="w-3 h-3 mr-1" />
                  Most Popular
                </Badge>
              )}
              {plan.current && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-500 text-white">
                  <Check className="w-3 h-3 mr-1" />
                  Current Plan
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold">
                  {plan.price}
                  <span className="text-base font-normal text-muted-foreground">/{plan.period}</span>
                </div>
                <p className="text-muted-foreground">{plan.description}</p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  className="w-full" 
                  variant={plan.popular ? "hero" : plan.current ? "outline" : "default"}
                  disabled={plan.current}
                  onClick={() => {
                    if (plan.name === 'Free') {
                      window.location.href = user ? '/app' : '/signup';
                    } else if (plan.name === 'Premium') {
                      window.location.href = user ? '/billing' : '/signup';
                    } else {
                      window.location.href = '/help';
                    }
                  }}
                >
                  {plan.popular && <Crown className="w-4 h-4 mr-2" />}
                  {plan.cta}
                </Button>

                {plan.limitations.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground mb-2">Limitations:</p>
                    {plan.limitations.map((limitation, index) => (
                      <div key={index} className="text-xs text-muted-foreground">
                        • {limitation}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Can I upgrade or downgrade at any time?</h3>
                <p className="text-muted-foreground">Yes! You can upgrade to Premium instantly. Your data and notes are always preserved.</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">What happens to my notes if I cancel Premium?</h3>
                <p className="text-muted-foreground">Your notes remain safe and accessible. You'll continue with Free tier limitations but keep all your existing content.</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
                <p className="text-muted-foreground">We offer a 7-day money-back guarantee for Premium subscriptions. Contact support for assistance.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6">Join thousands of users who trust NotaVoice for their voice notes.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={user ? "/app" : "/signup"} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gradient-primary text-primary-foreground hover:shadow-glow transition-bounce h-11 rounded-md px-8">
              <Zap className="w-4 h-4 mr-2" />
              {user ? "Start Recording" : "Start Free Trial"}
            </Link>
            <Link to="/help" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-border bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;