/**
 * Performance utilities for managing will-change property dynamically
 * This prevents browser memory budget exceeded warnings
 */
import React from 'react';

/**
 * Apply will-change property temporarily for optimized animations
 * Automatically removes it after animation completes
 */
export const applyWillChange = (
  element: HTMLElement,
  property: string,
  duration: number = 300
): void => {
  if (!element) return;
  
  element.style.willChange = property;
  
  setTimeout(() => {
    element.style.willChange = 'auto';
  }, duration);
};

/**
 * Apply will-change on hover and remove on hover out
 */
export const setupHoverWillChange = (
  element: HTMLElement,
  property: string = 'transform'
): void => {
  if (!element) return;
  
  const handleMouseEnter = () => {
    element.style.willChange = property;
  };
  
  const handleMouseLeave = () => {
    element.style.willChange = 'auto';
  };
  
  element.addEventListener('mouseenter', handleMouseEnter);
  element.addEventListener('mouseleave', handleMouseLeave);
  
  // Return cleanup function
  return () => {
    element.removeEventListener('mouseenter', handleMouseEnter);
    element.removeEventListener('mouseleave', handleMouseLeave);
    element.style.willChange = 'auto';
  };
};

/**
 * Apply will-change during scroll and remove when scroll stops
 */
export const setupScrollWillChange = (
  element: HTMLElement,
  property: string = 'scroll-position'
): void => {
  if (!element) return;
  
  let scrollTimeout: NodeJS.Timeout;
  
  const handleScroll = () => {
    element.style.willChange = property;
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      element.style.willChange = 'auto';
    }, 150); // Remove will-change 150ms after scrolling stops
  };
  
  element.addEventListener('scroll', handleScroll, { passive: true });
  
  // Return cleanup function
  return () => {
    element.removeEventListener('scroll', handleScroll);
    element.style.willChange = 'auto';
    clearTimeout(scrollTimeout);
  };
};

/**
 * Apply will-change during animation and remove when complete
 */
export const setupAnimationWillChange = (
  element: HTMLElement,
  property: string = 'transform'
): void => {
  if (!element) return;
  
  const handleAnimationStart = () => {
    element.style.willChange = property;
  };
  
  const handleAnimationEnd = () => {
    element.style.willChange = 'auto';
  };
  
  element.addEventListener('animationstart', handleAnimationStart);
  element.addEventListener('animationend', handleAnimationEnd);
  element.addEventListener('animationcancel', handleAnimationEnd);
  
  // Return cleanup function
  return () => {
    element.removeEventListener('animationstart', handleAnimationStart);
    element.removeEventListener('animationend', handleAnimationEnd);
    element.removeEventListener('animationcancel', handleAnimationEnd);
    element.style.willChange = 'auto';
  };
};

/**
 * React hook for managing will-change on an element
 */
export const useWillChange = (
  elementRef: React.RefObject<HTMLElement>,
  triggers: ('hover' | 'scroll' | 'animation')[],
  property: string = 'transform'
) => {
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const cleanupFunctions: (() => void)[] = [];
    
    triggers.forEach(trigger => {
      let cleanup: (() => void) | void;
      
      switch (trigger) {
        case 'hover':
          cleanup = setupHoverWillChange(element, property);
          break;
        case 'scroll':
          cleanup = setupScrollWillChange(element, property);
          break;
        case 'animation':
          cleanup = setupAnimationWillChange(element, property);
          break;
      }
      
      if (cleanup) {
        cleanupFunctions.push(cleanup);
      }
    });
    
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [elementRef, triggers, property]);
};