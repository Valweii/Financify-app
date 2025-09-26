import { useState, useRef, useCallback } from 'react';

interface UsePressInteractionOptions {
  scaleDown?: number;
  scaleUp?: number;
  duration?: number;
  shadowIntensity?: number;
}

export const usePressInteraction = (options: UsePressInteractionOptions = {}) => {
  const {
    scaleDown = 0.995,
    scaleUp = 1.01,
    duration = 200,
    shadowIntensity = 0.15
  } = options;

  const [isPressed, setIsPressed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handlePressStart = useCallback(() => {
    setIsPressed(true);
    setIsAnimating(true);
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
    
    // Scale up briefly then settle
    timeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, duration);
  }, [duration]);

  const getPressStyles = () => {
    if (isPressed) {
      return {
        transform: `scale(${scaleDown})`,
        transition: 'transform 50ms cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: `0 8px 30px -8px hsl(var(--primary) / ${shadowIntensity * 0.5})`
      };
    }
    
    if (isAnimating) {
      return {
        transform: `scale(${scaleUp})`,
        transition: `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        boxShadow: `0 8px 30px -8px hsl(var(--primary) / ${shadowIntensity})`
      };
    }
    
    return {
      transform: 'scale(1)',
      transition: `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      boxShadow: '0 4px 20px -4px hsl(var(--primary) / 0.1)'
    };
  };

  return {
    isPressed,
    isAnimating,
    handlePressStart,
    handlePressEnd,
    getPressStyles
  };
};
