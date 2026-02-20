import * as React from 'react';
import { useEffect } from 'react';

// Smooth scroll utility for anchor links
export const useSmoothScroll = () => {
  useEffect(() => {
    const handleAnchorClick = (e: Event) => {
      const target = e.target as HTMLAnchorElement;
      const href = target.getAttribute('href');
      
      if (href?.startsWith('/#')) {
        e.preventDefault();
        const elementId = href.substring(2);
        const element = document.getElementById(elementId);
        
        if (element) {
          const headerHeight = 80; // Account for sticky header
          const elementPosition = element.offsetTop - headerHeight;
          
          window.scrollTo({
            top: elementPosition,
            behavior: 'smooth'
          });
        }
      }
    };

    // Add event listeners to all anchor links
    const anchorLinks = document.querySelectorAll('a[href^="/#"]');
    anchorLinks.forEach(link => {
      link.addEventListener('click', handleAnchorClick);
    });

    // Cleanup
    return () => {
      anchorLinks.forEach(link => {
        link.removeEventListener('click', handleAnchorClick);
      });
    };
  }, []);
};

export default useSmoothScroll;