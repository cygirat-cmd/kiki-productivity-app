/**
 * Optimized Storage Manager - Async operations to prevent UI blocking
 * Replaces synchronous localStorage calls throughout the app
 */

import { STORAGE_KEYS } from '@/constants';

export interface StorageItem<T = any> {
  value: T;
  timestamp: number;
  expiry?: number;
}

class OptimizedStorageManager {
  private cache = new Map<string, any>();
  private pendingWrites = new Map<string, Promise<void>>();
  private batchTimer: NodeJS.Timeout | null = null;
  private batchedWrites = new Map<string, any>();

  /**
   * Asynchronous read with in-memory cache
   */
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    // Read from localStorage
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as StorageItem<T>;
        
        // Check expiry
        if (parsed.expiry && Date.now() > parsed.expiry) {
          this.remove(key);
          return defaultValue;
        }
        
        // Update cache
        this.cache.set(key, parsed.value);
        return parsed.value;
      }
    } catch (error) {
      console.warn(`Failed to read ${key} from storage:`, error);
    }

    return defaultValue;
  }

  /**
   * Asynchronous write with batching to prevent UI blocking
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    // Update cache immediately
    this.cache.set(key, value);

    const item: StorageItem<T> = {
      value,
      timestamp: Date.now(),
      expiry: ttlMs ? Date.now() + ttlMs : undefined
    };

    // Batch writes to avoid blocking UI
    this.batchedWrites.set(key, item);

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.flushBatchedWrites();
    }, 16); // Next frame

    return Promise.resolve();
  }

  /**
   * Immediate synchronous write for critical data
   */
  setSync<T>(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, value);
    
    const item: StorageItem<T> = {
      value,
      timestamp: Date.now(),
      expiry: ttlMs ? Date.now() + ttlMs : undefined
    };

    try {
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.error(`Failed to sync write ${key}:`, error);
    }
  }

  /**
   * Remove item from cache and storage
   */
  async remove(key: string): Promise<void> {
    this.cache.delete(key);
    this.batchedWrites.delete(key);
    
    return new Promise(resolve => {
      requestIdleCallback(() => {
        localStorage.removeItem(key);
        resolve();
      });
    });
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.batchedWrites.clear();
    
    return new Promise(resolve => {
      requestIdleCallback(() => {
        localStorage.clear();
        resolve();
      });
    });
  }

  /**
   * Flush batched writes to localStorage
   */
  private flushBatchedWrites(): void {
    if (this.batchedWrites.size === 0) return;

    requestIdleCallback(() => {
      for (const [key, item] of this.batchedWrites) {
        try {
          localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
          console.error(`Failed to write ${key}:`, error);
        }
      }
      this.batchedWrites.clear();
    });

    this.batchTimer = null;
  }

  /**
   * Preload commonly used keys into cache
   */
  async preload(keys: string[]): Promise<void> {
    const promises = keys.map(key => this.get(key));
    await Promise.all(promises);
  }

  /**
   * Get storage usage statistics
   */
  getStats(): { cacheSize: number; storageUsed: number } {
    let storageUsed = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        storageUsed += localStorage.getItem(key)?.length || 0;
      }
    }

    return {
      cacheSize: this.cache.size,
      storageUsed
    };
  }
}

// Singleton instance
export const storage = new OptimizedStorageManager();

// Typed storage helpers for specific data types
export const petStorage = {
  get: () => storage.get<any>(STORAGE_KEYS.PET),
  set: (pet: any) => storage.set(STORAGE_KEYS.PET, pet),
  remove: () => storage.remove(STORAGE_KEYS.PET)
};

export const tasksStorage = {
  get: () => storage.get<any[]>(STORAGE_KEYS.TASKS, []),
  set: (tasks: any[]) => storage.set(STORAGE_KEYS.TASKS, tasks),
  remove: () => storage.remove(STORAGE_KEYS.TASKS)
};

export const timerStorage = {
  get: () => storage.get<any>(STORAGE_KEYS.ACTIVE_TIMER),
  set: (timer: any) => storage.set(STORAGE_KEYS.ACTIVE_TIMER, timer),
  remove: () => storage.remove(STORAGE_KEYS.ACTIVE_TIMER)
};

export const pauseTokensStorage = {
  get: () => storage.get<number>(STORAGE_KEYS.PAUSE_TOKENS, 0),
  set: (tokens: number) => storage.set(STORAGE_KEYS.PAUSE_TOKENS, tokens),
  increment: async () => {
    const current = await pauseTokensStorage.get();
    return pauseTokensStorage.set(current + 1);
  }
};

export const verificationsStorage = {
  get: () => storage.get<any[]>(STORAGE_KEYS.VERIFICATIONS, []),
  set: (verifications: any[]) => storage.set(STORAGE_KEYS.VERIFICATIONS, verifications),
  add: async (verification: any) => {
    const current = await verificationsStorage.get();
    return verificationsStorage.set([...current, verification]);
  }
};