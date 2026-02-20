import * as React from "react";
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Lock, Star } from 'lucide-react';

interface PremiumFeatureProps {
  children: React.ReactNode;
  feature?: string;
  fallback?: React.ReactNode;
  requireAdmin?: boolean;
}

const PremiumFeature: React.FC<PremiumFeatureProps> = ({ 
  children, 
  feature = "premium feature", 
  fallback,
  requireAdmin = false 
}) => {
  const { isPremium, isAdmin } = useAuth();

  // Check permissions
  const hasAccess = requireAdmin ? isAdmin : (isPremium || isAdmin);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Show fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-base">
          {requireAdmin ? <Lock className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
          {requireAdmin ? 'Admin Only' : 'Premium Feature'}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          {requireAdmin 
            ? 'This feature is only available to system administrators.'
            : `Unlock this ${feature} with a premium subscription.`
          }
        </p>
        {!requireAdmin && (
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button 
              variant="premium" 
              size="sm"
              onClick={() => window.location.href = '/billing'}
            >
              <Star className="w-4 h-4 mr-2" />
              Upgrade Now
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/pricing'}
            >
              View Plans
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PremiumFeature;