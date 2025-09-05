/**
 * Rate Limiter for API calls and sensitive operations
 * Prevents abuse and improves security
 */

interface RateLimitRule {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

interface RateLimitAttempt {
  timestamp: number;
  count: number;
  blocked: boolean;
  blockExpires: number;
}

interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  resetTime: number;
  blocked: boolean;
  retryAfter?: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private attempts: Map<string, RateLimitAttempt> = new Map();
  
  // Default rate limit rules
  private readonly rules: Record<string, RateLimitRule> = {
    // API calls
    'supabase_upload': {
      maxAttempts: 50, // Increased for development
      windowMs: 60 * 1000, // 1 minute
      blockDurationMs: 1 * 60 * 1000 // Reduced to 1 minute
    },
    'verification_creation': {
      maxAttempts: 5,
      windowMs: 60 * 1000, // 1 minute  
      blockDurationMs: 10 * 60 * 1000 // 10 minutes
    },
    'auth_attempt': {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDurationMs: 30 * 60 * 1000 // 30 minutes
    },
    'task_completion': {
      maxAttempts: 20,
      windowMs: 60 * 1000, // 1 minute
      blockDurationMs: 2 * 60 * 1000 // 2 minutes
    },
    'data_export': {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDurationMs: 24 * 60 * 60 * 1000 // 24 hours
    },
    'data_deletion': {
      maxAttempts: 2,
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      blockDurationMs: 24 * 60 * 60 * 1000 // 24 hours
    },
    'edge_function': {
      maxAttempts: 30,
      windowMs: 60 * 1000, // 1 minute
      blockDurationMs: 5 * 60 * 1000 // 5 minutes
    }
  };

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Check if an operation is allowed and update rate limit
   */
  checkLimit(operation: string, identifier?: string): RateLimitResult {
    const rule = this.rules[operation];
    if (!rule) {
      console.warn(`No rate limit rule found for operation: ${operation}`);
      return {
        allowed: true,
        remainingAttempts: 999,
        resetTime: Date.now() + 60000,
        blocked: false
      };
    }

    const key = identifier ? `${operation}:${identifier}` : operation;
    const now = Date.now();
    const attempt = this.attempts.get(key);

    // Check if currently blocked
    if (attempt && attempt.blocked && now < attempt.blockExpires) {
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: attempt.blockExpires,
        blocked: true,
        retryAfter: attempt.blockExpires - now
      };
    }

    // Reset if window has passed
    if (!attempt || (now - attempt.timestamp) > rule.windowMs) {
      this.attempts.set(key, {
        timestamp: now,
        count: 1,
        blocked: false,
        blockExpires: 0
      });

      return {
        allowed: true,
        remainingAttempts: rule.maxAttempts - 1,
        resetTime: now + rule.windowMs,
        blocked: false
      };
    }

    // Increment attempt count
    attempt.count++;

    // Check if limit exceeded
    if (attempt.count > rule.maxAttempts) {
      attempt.blocked = true;
      attempt.blockExpires = now + rule.blockDurationMs;
      
      console.warn(`Rate limit exceeded for ${operation}. Blocked until ${new Date(attempt.blockExpires)}`);

      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: attempt.blockExpires,
        blocked: true,
        retryAfter: rule.blockDurationMs
      };
    }

    return {
      allowed: true,
      remainingAttempts: rule.maxAttempts - attempt.count,
      resetTime: attempt.timestamp + rule.windowMs,
      blocked: false
    };
  }

  /**
   * Decorator for rate-limited functions
   */
  withRateLimit<T extends any[], R>(
    operation: string,
    fn: (...args: T) => Promise<R>,
    identifier?: string
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const result = this.checkLimit(operation, identifier);
      
      if (!result.allowed) {
        const error = new Error(`Rate limit exceeded for ${operation}`);
        (error as any).rateLimitInfo = result;
        throw error;
      }

      try {
        return await fn(...args);
      } catch (error) {
        // Don't penalize for actual API errors, only successful calls count
        if (this.attempts.has(operation)) {
          const attempt = this.attempts.get(operation)!;
          attempt.count = Math.max(0, attempt.count - 1);
        }
        throw error;
      }
    };
  }

  /**
   * Reset rate limit for specific operation
   */
  resetLimit(operation: string, identifier?: string): void {
    const key = identifier ? `${operation}:${identifier}` : operation;
    this.attempts.delete(key);
  }

  /**
   * Get current status for operation
   */
  getStatus(operation: string, identifier?: string): RateLimitResult | null {
    const rule = this.rules[operation];
    if (!rule) return null;

    const key = identifier ? `${operation}:${identifier}` : operation;
    const attempt = this.attempts.get(key);
    const now = Date.now();

    if (!attempt) {
      return {
        allowed: true,
        remainingAttempts: rule.maxAttempts,
        resetTime: now + rule.windowMs,
        blocked: false
      };
    }

    // Check if currently blocked
    if (attempt.blocked && now < attempt.blockExpires) {
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: attempt.blockExpires,
        blocked: true,
        retryAfter: attempt.blockExpires - now
      };
    }

    // Check if window has passed
    if ((now - attempt.timestamp) > rule.windowMs) {
      return {
        allowed: true,
        remainingAttempts: rule.maxAttempts,
        resetTime: now + rule.windowMs,
        blocked: false
      };
    }

    return {
      allowed: attempt.count < rule.maxAttempts,
      remainingAttempts: Math.max(0, rule.maxAttempts - attempt.count),
      resetTime: attempt.timestamp + rule.windowMs,
      blocked: false
    };
  }

  /**
   * Clean up old entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, attempt] of this.attempts.entries()) {
      // Remove entries that are no longer blocked and past their window
      if (!attempt.blocked && (now - attempt.timestamp) > (15 * 60 * 1000)) {
        this.attempts.delete(key);
      }
      // Remove expired blocks
      if (attempt.blocked && now > attempt.blockExpires) {
        this.attempts.delete(key);
      }
    }
  }

  /**
   * Get all current limits status (for debugging)
   */
  getAllStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const operation of Object.keys(this.rules)) {
      status[operation] = this.getStatus(operation);
    }

    return status;
  }

  /**
   * Add custom rule
   */
  addRule(operation: string, rule: RateLimitRule): void {
    this.rules[operation] = rule;
  }

  /**
   * Update existing rule
   */
  updateRule(operation: string, updates: Partial<RateLimitRule>): void {
    if (this.rules[operation]) {
      this.rules[operation] = { ...this.rules[operation], ...updates };
    }
  }
}

// Export singleton instance
export const rateLimiter = RateLimiter.getInstance();

// Convenience functions for common operations
export const checkRateLimit = (operation: string, identifier?: string) => 
  rateLimiter.checkLimit(operation, identifier);

export const withRateLimit = <T extends any[], R>(
  operation: string,
  fn: (...args: T) => Promise<R>,
  identifier?: string
) => rateLimiter.withRateLimit(operation, fn, identifier);

export const resetRateLimit = (operation: string, identifier?: string) =>
  rateLimiter.resetLimit(operation, identifier);

// Types export
export type { RateLimitResult, RateLimitRule };

// Start cleanup interval
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000); // Clean up every 5 minutes