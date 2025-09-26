import { useState, useEffect, useRef } from 'react';

interface UseCounterAnimationOptions {
  duration?: number;
  startDelay?: number;
  easeOut?: boolean;
}

export const useCounterAnimation = (
  targetValue: number,
  options: UseCounterAnimationOptions = {}
) => {
  const {
    duration = 1000,
    startDelay = 0,
    easeOut = true
  } = options;

  const [currentValue, setCurrentValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    if (targetValue === 0) {
      setCurrentValue(0);
      return;
    }

    const startAnimation = () => {
      setIsAnimating(true);
      setCurrentValue(0);
      
      const animate = (currentTime: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = currentTime;
        }

        const elapsed = currentTime - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const easeOutProgress = easeOut ? 1 - Math.pow(1 - progress, 3) : progress;
        
        const newValue = Math.round(targetValue * easeOutProgress);
        setCurrentValue(newValue);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setCurrentValue(targetValue);
          setIsAnimating(false);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    };

    const timeoutId = setTimeout(startAnimation, startDelay);

    return () => {
      clearTimeout(timeoutId);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration, startDelay, easeOut]);

  return { currentValue, isAnimating };
};
