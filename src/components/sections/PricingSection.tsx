import * as React from "react";
import { Button } from '@/components/ui/button';
import { Card } from "@/components/ui/card";
import { Check, Star, Zap } from "lucide-react";

const PricingSection = () => {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for getting started",
      features: [
        "10 transcriptions per month",
        "3 minutes max per recording",
        "Basic grammar correction",
        "Standard transcription speed",
        "Export as text"
      ],
      buttonText: "Start Free",
      buttonVariant: "outline" as const,
      popular: false
    },
    {
      name: "AudioPen Prime",
      price: "$99",
      period: "per year",
      originalPrice: "$159",
      description: "For serious users who want unlimited access",
      features: [
        "Unlimited transcriptions",
        "15 minutes max per recording",
        "Advanced AI grammar correction",
        "Lightning fast processing",
        "Multiple output styles",
        "50+ language support",
        "Priority customer support",
        "Zapier integration",
        "Export in multiple formats",
        "Public note sharing"
      ],
      buttonText: "Upgrade to Prime",
      buttonVariant: "hero" as const,
      popular: true,
      badge: "Most Popular"
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container max-w-screen-xl mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-4">
            <Star className="mr-2 h-4 w-4" />
            Simple, Transparent Pricing
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start Free, Upgrade When Ready
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            No auto-renewals, no hidden fees. Pay once and use AudioPen Prime for a full year.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`p-8 relative ${
                plan.popular 
                  ? 'ring-2 ring-primary shadow-lg gradient-card' 
                  : 'border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1 rounded-full">
                    {plan.badge}
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-3">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-1">/{plan.period}</span>
                  {plan.originalPrice && (
                    <span className="text-lg text-muted-foreground line-through ml-2">
                      {plan.originalPrice}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant={plan.buttonVariant} 
                size="lg" 
                className="w-full"
              >
                {plan.popular && <Zap className="mr-2 h-4 w-4" />}
                {plan.buttonText}
              </Button>
            </Card>
          ))}
        </div>

        {/* FAQ Quick Links */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            Questions about pricing or features?
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button variant="ghost" size="sm">
              View FAQ
            </Button>
            <Button variant="ghost" size="sm">
              Contact Support
            </Button>
            <Button variant="ghost" size="sm">
              See All Features
            </Button>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="mt-16 p-8 bg-accent rounded-lg text-center">
          <h4 className="text-xl font-semibold mb-3">Why Choose AudioPen Prime?</h4>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="text-2xl font-bold text-primary mb-1">No Auto-Renewal</div>
              <p className="text-muted-foreground">Pay once, use for a full year. No surprises.</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary mb-1">15 Min Max</div>
              <p className="text-muted-foreground">Perfect for lectures, meetings, and interviews.</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary mb-1">50+ Languages</div>
              <p className="text-muted-foreground">Global support with accent recognition.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;