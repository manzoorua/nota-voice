import * as React from "react";
import { useAuth } from '@/hooks/useAuth';

interface FeatureGateProps {
  children: React.ReactNode;
  requirePremium?: boolean;
  requireAdmin?: boolean;
  fallback?: React.ReactNode;
}

const FeatureGate: React.FC<FeatureGateProps> = ({ 
  children, 
  requirePremium = false,
  requireAdmin = false,
  fallback = null 
}) => {
  const { isPremium, isAdmin } = useAuth();

  // Check permissions
  if (requireAdmin && !isAdmin) {
    return fallback ? <>{fallback}</> : null;
  }

  if (requirePremium && !isPremium && !isAdmin) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};

export default FeatureGate;