import * as React from 'react';

interface GestureConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onPinch?: (scale: number) => void;
  threshold?: number;
  longPressDelay?: number;
}

export const useGestures = (config: GestureConfig) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [gestureState, setGestureState] = React.useState({
    isPressed: false,
    startPoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
    startTime: 0,
    tapCount: 0
  });

  const threshold = config.threshold || 50;
  const longPressDelay = config.longPressDelay || 500;

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let longPressTimer: NodeJS.Timeout | null = null;
    let doubleTapTimer: NodeJS.Timeout | null = null;
    let touches: Touch[] = [];

    // Touch start
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touches = Array.from(e.touches);
      
      setGestureState(prev => ({
        ...prev,
        isPressed: true,
        startPoint: { x: touch.clientX, y: touch.clientY },
        currentPoint: { x: touch.clientX, y: touch.clientY },
        startTime: Date.now()
      }));

      // Start long press timer
      if (config.onLongPress) {
        longPressTimer = setTimeout(() => {
          config.onLongPress!();
          if (navigator.vibrate) {
            navigator.vibrate(50); // Haptic feedback
          }
        }, longPressDelay);
      }

      e.preventDefault();
    };

    // Touch move
    const handleTouchMove = (e: TouchEvent) => {
      if (!gestureState.isPressed) return;
      
      const touch = e.touches[0];
      touches = Array.from(e.touches);
      
      setGestureState(prev => ({
        ...prev,
        currentPoint: { x: touch.clientX, y: touch.clientY }
      }));

      // Cancel long press if moved too much
      const deltaX = Math.abs(touch.clientX - gestureState.startPoint.x);
      const deltaY = Math.abs(touch.clientY - gestureState.startPoint.y);
      
      if ((deltaX > 10 || deltaY > 10) && longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      // Handle pinch gesture
      if (e.touches.length === 2 && config.onPinch) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        if (touches.length === 2) {
          const initialDistance = Math.sqrt(
            Math.pow(touches[1].clientX - touches[0].clientX, 2) + 
            Math.pow(touches[1].clientY - touches[0].clientY, 2)
          );
          const scale = distance / initialDistance;
          config.onPinch(scale);
        }
      }

      e.preventDefault();
    };

    // Touch end
    const handleTouchEnd = (e: TouchEvent) => {
      if (!gestureState.isPressed) return;

      const deltaX = gestureState.currentPoint.x - gestureState.startPoint.x;
      const deltaY = gestureState.currentPoint.y - gestureState.startPoint.y;
      const deltaTime = Date.now() - gestureState.startTime;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Clear timers
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      // Handle swipe gestures
      if (distance > threshold) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal swipe
          if (deltaX > 0 && config.onSwipeRight) {
            config.onSwipeRight();
            if (navigator.vibrate) navigator.vibrate(25);
          } else if (deltaX < 0 && config.onSwipeLeft) {
            config.onSwipeLeft();
            if (navigator.vibrate) navigator.vibrate(25);
          }
        } else {
          // Vertical swipe
          if (deltaY > 0 && config.onSwipeDown) {
            config.onSwipeDown();
            if (navigator.vibrate) navigator.vibrate(25);
          } else if (deltaY < 0 && config.onSwipeUp) {
            config.onSwipeUp();
            if (navigator.vibrate) navigator.vibrate(25);
          }
        }
      } else if (deltaTime < 300 && distance < 10) {
        // Handle tap gestures
        setGestureState(prev => ({ ...prev, tapCount: prev.tapCount + 1 }));

        if (config.onDoubleTap) {
          if (gestureState.tapCount === 0) {
            doubleTapTimer = setTimeout(() => {
              if (config.onTap) config.onTap();
              setGestureState(prev => ({ ...prev, tapCount: 0 }));
            }, 250);
          } else {
            if (doubleTapTimer) clearTimeout(doubleTapTimer);
            config.onDoubleTap();
            setGestureState(prev => ({ ...prev, tapCount: 0 }));
            if (navigator.vibrate) navigator.vibrate(30);
          }
        } else if (config.onTap) {
          config.onTap();
        }
      }

      setGestureState(prev => ({
        ...prev,
        isPressed: false
      }));

      e.preventDefault();
    };

    // Mouse events for desktop
    const handleMouseDown = (e: MouseEvent) => {
      setGestureState(prev => ({
        ...prev,
        isPressed: true,
        startPoint: { x: e.clientX, y: e.clientY },
        currentPoint: { x: e.clientX, y: e.clientY },
        startTime: Date.now()
      }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!gestureState.isPressed) return;
      setGestureState(prev => ({
        ...prev,
        currentPoint: { x: e.clientX, y: e.clientY }
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!gestureState.isPressed) return;
      
      const deltaX = e.clientX - gestureState.startPoint.x;
      const deltaY = e.clientY - gestureState.startPoint.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance < 10 && config.onTap) {
        config.onTap();
      }

      setGestureState(prev => ({
        ...prev,
        isPressed: false
      }));
    };

    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseup', handleMouseUp);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseup', handleMouseUp);
      
      if (longPressTimer) clearTimeout(longPressTimer);
      if (doubleTapTimer) clearTimeout(doubleTapTimer);
    };
  }, [config, threshold, longPressDelay, gestureState]);

  return ref;
};