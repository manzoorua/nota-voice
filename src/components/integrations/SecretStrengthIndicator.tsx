import * as React from "react";
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface SecretStrengthIndicatorProps {
  secret: string;
}

const SecretStrengthIndicator: React.FC<SecretStrengthIndicatorProps> = ({ secret }) => {
  const calculateStrength = (secret: string) => {
    let score = 0;
    const checks = {
      length: secret.length >= 12,
      uppercase: /[A-Z]/.test(secret),
      lowercase: /[a-z]/.test(secret),
      numbers: /[0-9]/.test(secret),
      symbols: /[^A-Za-z0-9]/.test(secret),
    };

    Object.values(checks).forEach(check => {
      if (check) score += 20;
    });

    return { score, checks };
  };

  const { score, checks } = calculateStrength(secret);
  
  const getStrengthText = (score: number) => {
    if (score >= 100) return { text: 'Very Strong', color: 'bg-green-500', variant: 'default' as const };
    if (score >= 80) return { text: 'Strong', color: 'bg-blue-500', variant: 'default' as const };
    if (score >= 60) return { text: 'Medium', color: 'bg-yellow-500', variant: 'secondary' as const };
    if (score >= 40) return { text: 'Weak', color: 'bg-orange-500', variant: 'destructive' as const };
    return { text: 'Very Weak', color: 'bg-red-500', variant: 'destructive' as const };
  };

  const strength = getStrengthText(score);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">Secret Strength:</span>
        <Badge variant={strength.variant} className="text-xs">
          {strength.text}
        </Badge>
      </div>
      
      <Progress value={score} className="h-2" />
      
      <div className="grid grid-cols-1 gap-1 text-xs">
        <div className="flex items-center gap-1">
          {checks.length ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
          <span className={checks.length ? 'text-green-700' : 'text-red-700'}>
            12+ characters
          </span>
        </div>
        <div className="flex items-center gap-1">
          {checks.uppercase ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
          <span className={checks.uppercase ? 'text-green-700' : 'text-red-700'}>
            Uppercase letters
          </span>
        </div>
        <div className="flex items-center gap-1">
          {checks.lowercase ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
          <span className={checks.lowercase ? 'text-green-700' : 'text-red-700'}>
            Lowercase letters
          </span>
        </div>
        <div className="flex items-center gap-1">
          {checks.numbers ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
          <span className={checks.numbers ? 'text-green-700' : 'text-red-700'}>
            Numbers
          </span>
        </div>
        <div className="flex items-center gap-1">
          {checks.symbols ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
          <span className={checks.symbols ? 'text-green-700' : 'text-red-700'}>
            Special characters
          </span>
        </div>
      </div>
      
      {score < 80 && (
        <div className="flex items-start gap-1 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-800">
            Strong secrets help protect your webhooks from unauthorized access. 
            Consider using a password manager to generate secure secrets.
          </p>
        </div>
      )}
    </div>
  );
};

export default SecretStrengthIndicator;