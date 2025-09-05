/**
 * Application Constants - Centralized configuration
 * All magic numbers and strings should be defined here
 */

// Cache durations (in milliseconds)
export const CACHE_DURATIONS = {
  ONE_MINUTE: 60 * 1000,
  TWO_MINUTES: 2 * 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
} as const;

// Refetch intervals
export const REFETCH_INTERVALS = {
  THIRTY_SECONDS: 30 * 1000,
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
} as const;

// File size limits
export const FILE_SIZE_LIMITS = {
  IMAGE_MAX_FREE: 5 * 1024 * 1024, // 5MB
  IMAGE_MAX_PREMIUM: 20 * 1024 * 1024, // 20MB
  IMAGE_MAX_TOTAL: 50 * 1024 * 1024, // 50MB
  IMAGE_COMPRESSION_THRESHOLD: 2 * 1024 * 1024, // 2MB - trigger extra compression
  IMAGE_WARNING_THRESHOLD: 1 * 1024 * 1024, // 1MB - show size warning
} as const;

// Request timeouts
export const TIMEOUTS = {
  AI_REQUEST: 30000, // 30 seconds
  DATABASE_REQUEST: 10000, // 10 seconds
  STORAGE_UPLOAD: 60000, // 60 seconds
  DEFAULT_REQUEST: 5000, // 5 seconds
} as const;

// AI scoring thresholds
export const AI_THRESHOLDS = {
  APPROVE_DEFAULT: 0.8,
  REJECT_DEFAULT: 0.2,
  APPROVE_CREATIVE: 0.7,
  REJECT_CREATIVE: 0.3,
  APPROVE_OBJECTIVE: 0.85,
  REJECT_OBJECTIVE: 0.15,
} as const;

// Timer and notification settings
export const TIMER_CONFIG = {
  DEFAULT_POMODORO: 25, // minutes
  MAX_PAUSE_TIME: 300, // 5 minutes in seconds
  VALIDATION_TIME: 60, // 1 minute in seconds
  QUOTE_ROTATION_INTERVAL: 3000, // 3 seconds
  BOREDOM_DEATH_THRESHOLD: 72 * 60 * 60 * 1000, // 72 hours
} as const;

// Storage keys - centralized to avoid typos
export const STORAGE_KEYS = {
  PET: 'kiki-pet',
  TASKS: 'kiki-tasks',
  ACTIVE_TIMER: 'kiki-active-timer',
  PENDING_VALIDATION: 'kiki-pending-validation',
  VERIFICATIONS: 'kiki-verifications',
  PAUSE_TOKENS: 'kiki-pause-tokens',
  SESSION_STATS: 'kiki-session-stats',
  CEMETERY: 'kiki-cemetery',
  COINS: 'kiki-coins',
  OWNED_ITEMS: 'kiki-owned-items',
  LAST_ACTIVITY: 'kiki-last-activity',
  APP_BACKGROUNDED: 'kiki-app-backgrounded',
  PENDING_SHARE_URL: 'kiki-pending-share-url',
  INACTIVITY_TIMEOUTS: 'kiki-inactivity-timeouts',
  LAST_CLOUD_SYNC: 'kiki-last-cloud-sync',
  INSURANCE: 'kiki-insurance',
} as const;

// React Query keys
export const QUERY_KEYS = {
  PET: ['pet'],
  TASKS: ['tasks'],
  VERIFICATIONS: ['verifications'],
  USER_PROFILE: ['userProfile'],
  STATS: ['stats'],
  PREMIUM_STATUS: (userId: string) => ['premiumStatus', userId],
  SIGNED_URL: (path: string) => ['signedUrl', path],
} as const;

// Pet types and assets
export const PET_TYPES = {
  CAT: 'cat',
  BUNNY: 'bunny',
  PENGUIN: 'penguin',
} as const;

// Task statuses
export const TASK_STATUS = {
  TODO: 'todo',
  DOING: 'doing',
  DONE: 'done',
} as const;

// Verification statuses
export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  TRIAL: 'trial',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

// UI configuration
export const UI_CONFIG = {
  MAX_QUOTE_INDEX: 6, // 0-6 = 7 quotes total
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  DESKTOP_BREAKPOINT: 1200,
  
  // Animation durations
  ANIMATION_FAST: 150,
  ANIMATION_NORMAL: 200,
  ANIMATION_SLOW: 300,
  
  // Toast settings
  TOAST_DURATION: 4000,
  TOAST_REMOVE_DELAY: 1000,
  
  // Modal settings
  MODAL_CLOSE_DELAY: 300,
} as const;

// API configuration
export const API_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // milliseconds
  MAX_BATCH_SIZE: 10,
  DEBOUNCE_DELAY: 2000, // 2 seconds
} as const;

// Death reasons templates
export const DEATH_REASONS = {
  TIMER_ABANDONED: (minutes: number) => 
    `CORPORATE EXECUTION: Productivity Agent abandoned for ${minutes} minutes during active session. Negligence protocols triggered. Agent terminated. - Kiki Corp Operations 🏢⏰`,
  
  TIMER_EXPIRED: () =>
    `CORPORATE EXECUTION: Timer protocol violated. Productivity Agent #4251 failed to complete assigned task within allocated timeframe. Termination effective immediately. - Kiki Corp Time Management Division ⏰🏢`,
  
  BOREDOM_DEATH: () =>
    `CORPORATE EXECUTION: Productivity Agent inactive for 72+ hours. Performance metrics unacceptable. Contract terminated effective immediately. Replacement unit incoming. - Kiki Corp HR Department 🏢📊`,
  
  OVERDUE_TASKS: (count: number) =>
    `CORPORATE EXECUTION: ${count} overdue task(s) detected. Productivity Agent #4251 performance unacceptable. Contract voided. Replacement agent being deployed. - Kiki Corp Task Management 📋🏢`,
} as const;

// Unhinged quotes for pet
export const PET_QUOTES = [
  "Senpai... please don't forget about me...",
  "I'm literally dying to see you succeed!",
  "Do something productive or I'm toast!",
  "Your procrastination is my death sentence!",
  "Please... I have so much to live for!",
  "Remember me when you're scrolling TikTok...",
  "I believe in you... don't make me regret it!"
] as const;

// Environment validation
export const ENV_VARS = {
  SUPABASE_URL: 'VITE_SUPABASE_URL',
  SUPABASE_ANON_KEY: 'VITE_SUPABASE_ANON_KEY',
  OPENAI_API_KEY: 'VITE_OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'VITE_ANTHROPIC_API_KEY',
} as const;

// Level calculation
export const LEVEL_CONFIG = {
  DAYS_PER_LEVEL: 7,
  MAX_LEVEL: 100,
} as const;

// Notification settings
export const NOTIFICATION_CONFIG = {
  PERMISSION_REQUEST_DELAY: 1000,
  AUTO_CLOSE_DELAY_MOBILE: 8000,
  AUTO_CLOSE_DELAY_DESKTOP: 5000,
  REMINDER_INTERVALS: [15, 30, 60], // minutes before due
} as const;