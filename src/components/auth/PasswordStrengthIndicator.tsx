import React from 'react';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ 
  password, 
  className = "" 
}) => {
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };
    
    score = Object.values(checks).filter(Boolean).length;
    
    return {
      score,
      checks,
      strength: score < 2 ? 'weak' : score < 4 ? 'medium' : 'strong'
    };
  };

  if (!password) return null;

  const { score, checks, strength } = getPasswordStrength(password);
  
  const strengthColors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500'
  };

  const strengthText = {
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong'
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Password strength</span>
        <span className={`text-sm font-medium ${
          strength === 'weak' ? 'text-red-600' : 
          strength === 'medium' ? 'text-yellow-600' : 
          'text-green-600'
        }`}>
          {strengthText[strength]}
        </span>
      </div>
      
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-2 flex-1 rounded-full ${
              level <= score 
                ? strengthColors[strength]
                : 'bg-muted'
            }`}
          />
        ))}
      </div>
      
      <div className="space-y-1 text-xs text-muted-foreground">
        {Object.entries(checks).map(([key, passed]) => (
          <div key={key} className={`flex items-center space-x-2 ${passed ? 'text-green-600' : ''}`}>
            <span className={`w-3 h-3 rounded-full border ${
              passed ? 'bg-green-500 border-green-500' : 'border-muted-foreground'
            }`}>
              {passed && <span className="block w-full h-full text-white text-center text-xs leading-3">✓</span>}
            </span>
            <span>
              {key === 'length' && 'At least 8 characters'}
              {key === 'uppercase' && 'Uppercase letter'}
              {key === 'lowercase' && 'Lowercase letter'}
              {key === 'number' && 'Number'}
              {key === 'special' && 'Special character'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};