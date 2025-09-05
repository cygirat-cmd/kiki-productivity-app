// Mobile-specific performance optimizations

// Detect device capabilities
export const getDeviceCapabilities = () => {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isLowEnd = isMobile && (
    /Android.*[123]\./i.test(ua) || // Old Android
    /iPhone.*OS [56789]_/i.test(ua) || // Old iOS
    navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4 // Low CPU cores
  );

  return {
    isMobile,
    isLowEnd,
    maxConcurrentAssets: isLowEnd ? 1 : isMobile ? 2 : 4,
    maxEquippedItems: isLowEnd ? 3 : isMobile ? 5 : 8,
    reduceAnimations: isLowEnd,
    useLowQualityAssets: isLowEnd
  };
};

// Adaptive animation quality
export const getAnimationQuality = () => {
  const { isLowEnd, isMobile } = getDeviceCapabilities();
  
  if (isLowEnd) {
    return {
      fps: 30,
      hairPhysics: false,
      particleCount: 0,
      shadowQuality: 'none' as const
    };
  }
  
  if (isMobile) {
    return {
      fps: 45,
      hairPhysics: true,
      particleCount: 5,
      shadowQuality: 'low' as const
    };
  }
  
  return {
    fps: 60,
    hairPhysics: true,
    particleCount: 20,
    shadowQuality: 'high' as const
  };
};

// Touch-friendly component sizing
export const getTouchSizing = () => {
  const isMobile = window.innerWidth < 768;
  
  return {
    slotSize: isMobile ? 48 : 40, // 48px minimum for touch targets
    iconSize: isMobile ? 32 : 24,
    buttonHeight: isMobile ? 44 : 36,
    gridGap: isMobile ? 12 : 16
  };
};

// Performance monitoring
export const createPerformanceMonitor = () => {
  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 60;

  const updateFPS = () => {
    frameCount++;
    const now = performance.now();
    
    if (now - lastTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - lastTime));
      frameCount = 0;
      lastTime = now;
      
      // Warn if FPS drops below 30
      if (fps < 30) {
        console.warn(`🐌 Low FPS detected: ${fps}fps`);
      }
    }
    
    requestAnimationFrame(updateFPS);
  };

  updateFPS();
  
  return {
    getFPS: () => fps,
    isPerformanceGood: () => fps >= 45
  };
};

// Throttled event handler for performance
export const createThrottledHandler = <T extends any[]>(
  handler: (...args: T) => void,
  delay: number = 16 // ~60fps
) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: T | null = null;

  return (...args: T) => {
    lastArgs = args;
    
    if (timeoutId === null) {
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          handler(...lastArgs);
        }
        timeoutId = null;
        lastArgs = null;
      }, delay);
    }
  };
};