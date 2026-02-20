import * as React from 'react';

interface LinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const Link: React.FC<LinkProps> = ({ to, children, className, onClick }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick?.(e);
    
    // Navigate without page reload
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', to);
      // Trigger custom event to update router
      window.dispatchEvent(new CustomEvent('navigate', { detail: { path: to } }));
    }
  };

  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  );
};

export default Link;