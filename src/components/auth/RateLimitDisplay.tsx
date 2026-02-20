import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

interface RateLimitDisplayProps {
  attemptsRemaining?: number;
  lockedUntil?: string;
  maxAttempts?: number;
  className?: string;
}

export const RateLimitDisplay: React.FC<RateLimitDisplayProps> = ({
  attemptsRemaining,
  lockedUntil,
  maxAttempts = 3,
  className = ""
}) => {
  if (lockedUntil) {
    const lockTime = new Date(lockedUntil);
    const timeRemaining = Math.ceil((lockTime.getTime() - Date.now()) / 60000);
    
    return (
      <div className={`p-3 bg-red-50 border border-red-200 rounded-md ${className}`}>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-red-800">Account Temporarily Locked</span>
        </div>
        <p className="text-sm text-red-700 mt-1">
          Too many failed attempts. Please wait {timeRemaining} minutes before trying again.
        </p>
      </div>
    );
  }

  if (attemptsRemaining !== undefined && attemptsRemaining < maxAttempts) {
    const attemptsUsed = maxAttempts - attemptsRemaining;
    const isWarning = attemptsRemaining <= 1;
    
    return (
      <div className={`p-3 border rounded-md ${
        isWarning ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'
      } ${className}`}>
        <div className="flex items-center space-x-2">
          <Clock className={`w-4 h-4 ${isWarning ? 'text-yellow-600' : 'text-blue-600'}`} />
          <span className={`text-sm font-medium ${
            isWarning ? 'text-yellow-800' : 'text-blue-800'
          }`}>
            Rate Limit Info
          </span>
        </div>
        <p className={`text-sm mt-1 ${isWarning ? 'text-yellow-700' : 'text-blue-700'}`}>
          {attemptsRemaining} of {maxAttempts} attempts remaining in the next hour.
          {isWarning && ' Please be careful with your next attempt.'}
        </p>
      </div>
    );
  }

  return null;
};