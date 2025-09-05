import { useState, useEffect } from 'react';

type MemoryPressure = 'low' | 'normal' | 'high' | 'critical';

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

declare global {
  interface Performance {
    memory?: MemoryInfo;
  }
}

export const useMemoryPressure = () => {
  const [pressure, setPressure] = useState<MemoryPressure>('normal');
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);

  useEffect(() => {
    // Check if memory API is available (Chrome only)
    if (!('memory' in performance)) {
      console.debug('Memory API not available - memory pressure monitoring disabled');
      return;
    }

    const checkMemoryPressure = () => {
      const memory = performance.memory!;
      const usage = memory.usedJSHeapSize;
      const limit = memory.jsHeapSizeLimit;
      const usagePercent = (usage / limit) * 100;

      setMemoryInfo(memory);

      // Determine pressure level
      let newPressure: MemoryPressure = 'normal';
      if (usagePercent > 90) newPressure = 'critical';
      else if (usagePercent > 75) newPressure = 'high';
      else if (usagePercent < 25) newPressure = 'low';

      setPressure(newPressure);

      // Log critical memory situations
      if (newPressure === 'critical') {
        console.warn('🚨 Critical memory pressure detected:', {
          used: `${(usage / 1024 / 1024).toFixed(1)}MB`,
          limit: `${(limit / 1024 / 1024).toFixed(1)}MB`,
          percentage: `${usagePercent.toFixed(1)}%`
        });
      }
    };

    // Check memory every 5 seconds
    const interval = setInterval(checkMemoryPressure, 5000);
    
    // Initial check
    checkMemoryPressure();

    return () => clearInterval(interval);
  }, []);

  // Memory optimization recommendations based on pressure
  const getOptimizationSuggestions = () => {
    switch (pressure) {
      case 'critical':
        return {
          reduceAnimations: true,
          clearImageCache: true,
          limitEquippedItems: 2,
          disableParticles: true
        };
      case 'high':
        return {
          reduceAnimations: false,
          clearImageCache: true,
          limitEquippedItems: 4,
          disableParticles: true
        };
      case 'low':
        return {
          reduceAnimations: false,
          clearImageCache: false,
          limitEquippedItems: 8,
          disableParticles: false
        };
      default:
        return {
          reduceAnimations: false,
          clearImageCache: false,
          limitEquippedItems: 6,
          disableParticles: false
        };
    }
  };

  return {
    pressure,
    memoryInfo,
    optimizations: getOptimizationSuggestions(),
    shouldReduceQuality: pressure === 'high' || pressure === 'critical',
    shouldClearCache: pressure === 'critical'
  };
};