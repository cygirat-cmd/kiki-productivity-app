import { useState, useEffect, useRef } from 'react';

interface AssetLoadingState {
  loaded: Set<string>;
  loading: Set<string>;
  errors: Set<string>;
}

// Asset preloader with Web Worker fallback
class AssetPreloader {
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();

  async preloadImage(src: string): Promise<HTMLImageElement> {
    // Return cached image if available
    if (this.imageCache.has(src)) {
      return this.imageCache.get(src)!;
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    // Create new loading promise
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.imageCache.set(src, img);
        this.loadingPromises.delete(src);
        resolve(img);
      };
      
      img.onerror = () => {
        this.loadingPromises.delete(src);
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      // Start loading
      img.src = src;
    });

    this.loadingPromises.set(src, promise);
    return promise;
  }

  // Preload multiple images with concurrency limit
  async preloadImages(sources: string[], maxConcurrent: number = 3): Promise<void> {
    const chunks = [];
    for (let i = 0; i < sources.length; i += maxConcurrent) {
      chunks.push(sources.slice(i, i + maxConcurrent));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(chunk.map(src => this.preloadImage(src)));
    }
  }

  // Get cached image if available
  getCachedImage(src: string): HTMLImageElement | undefined {
    return this.imageCache.get(src);
  }

  // Clear cache to free memory
  clearCache(): void {
    this.imageCache.clear();
    this.loadingPromises.clear();
  }
}

// Global preloader instance
const assetPreloader = new AssetPreloader();

export const useItemAssets = (equippedItems: Record<number, any>) => {
  const [assetState, setAssetState] = useState<AssetLoadingState>({
    loaded: new Set(),
    loading: new Set(),
    errors: new Set()
  });
  
  const prevEquippedRef = useRef<Record<number, any>>({});

  useEffect(() => {
    const currentPaths = Object.values(equippedItems)
      .filter(Boolean)
      .map(item => item.imagePath || `/assets/items/${item.name.toLowerCase().replace(/\s+/g, '')}.png`)
      .filter(Boolean);

    const prevPaths = Object.values(prevEquippedRef.current)
      .filter(Boolean)
      .map(item => item.imagePath || `/assets/items/${item.name.toLowerCase().replace(/\s+/g, '')}.png`)
      .filter(Boolean);

    // Only load new assets that aren't already loaded/loading
    const newPaths = currentPaths.filter(path => 
      !assetState.loaded.has(path) && 
      !assetState.loading.has(path)
    );

    if (newPaths.length === 0) {
      prevEquippedRef.current = equippedItems;
      return;
    }

    // Update loading state
    setAssetState(prev => ({
      ...prev,
      loading: new Set([...prev.loading, ...newPaths])
    }));

    // Preload new assets with priority for equipped items
    const loadAssets = async () => {
      try {
        await assetPreloader.preloadImages(newPaths, 2); // Limit concurrent loads
        
        setAssetState(prev => ({
          loaded: new Set([...prev.loaded, ...newPaths]),
          loading: new Set([...prev.loading].filter(path => !newPaths.includes(path))),
          errors: prev.errors
        }));
      } catch (error) {
        console.error('Asset loading error:', error);
        setAssetState(prev => ({
          ...prev,
          loading: new Set([...prev.loading].filter(path => !newPaths.includes(path))),
          errors: new Set([...prev.errors, ...newPaths])
        }));
      }
    };

    loadAssets();
    prevEquippedRef.current = equippedItems;
  }, [equippedItems, assetState.loaded, assetState.loading]);

  // Cleanup unused assets on unmount or when items change
  useEffect(() => {
    return () => {
      // Clear cache when component unmounts to free memory
      const hasEquippedItems = Object.keys(equippedItems).length > 0;
      if (!hasEquippedItems) {
        assetPreloader.clearCache();
      }
    };
  }, []);

  return {
    isLoaded: (path: string) => assetState.loaded.has(path),
    isLoading: (path: string) => assetState.loading.has(path),
    hasError: (path: string) => assetState.errors.has(path),
    getCachedImage: (path: string) => assetPreloader.getCachedImage(path),
    preloadImage: (path: string) => assetPreloader.preloadImage(path),
    clearCache: () => assetPreloader.clearCache()
  };
};