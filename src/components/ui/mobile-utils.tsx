import { useState, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileNotificationProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  variant?: 'info' | 'success' | 'warning';
}

export const MobileNotification = ({ 
  message, 
  action, 
  onDismiss, 
  variant = 'info' 
}: MobileNotificationProps) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 p-3 shadow-md",
      variant === 'info' && "bg-primary text-primary-foreground",
      variant === 'success' && "bg-success text-success-foreground", 
      variant === 'warning' && "bg-yellow-500 text-yellow-50"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex-1 pr-2">{message}</p>
        <div className="flex items-center gap-2">
          {action && (
            <Button
              size="sm"
              variant="ghost"
              onClick={action.onClick}
              className="text-current hover:bg-white/20"
            >
              {action.label}
            </Button>
          )}
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-current hover:bg-white/20 p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Hook for mobile app installation prompt
export const useMobileInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
  };

  return {
    showInstallPrompt,
    handleInstall,
    handleDismiss
  };
};

export default MobileNotification;