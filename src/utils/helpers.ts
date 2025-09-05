/**
 * Common Utility Helpers - Extracted reusable functions
 * Reduces code duplication across components
 */

import { STORAGE_KEYS, LEVEL_CONFIG, PET_TYPES, TASK_STATUS } from '@/constants';
import kikiCat from '@/assets/kiki/Kiki.png';
import kikiBunny from '@/assets/kiki-bunny-happy.png';
import kikiPenguin from '@/assets/kiki-penguin-happy.png';

// UUID generation helper
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Date formatting helpers
export function formatDate(date: Date): string {
  return date.toDateString();
}

export function getYesterday(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toDateString();
}

export function getToday(): string {
  return new Date().toDateString();
}

// Level calculation helper
export function calculateLevel(streak: number): number {
  return Math.floor(streak / LEVEL_CONFIG.DAYS_PER_LEVEL) + 1;
}

// Pet image helper
export function getPetImage(petType: string): string {
  const images = {
    [PET_TYPES.CAT]: kikiCat,
    [PET_TYPES.BUNNY]: kikiBunny,
    [PET_TYPES.PENGUIN]: kikiPenguin,
  };
  
  return images[petType as keyof typeof images] || images[PET_TYPES.CAT];
}

// Storage helpers with error handling
export function safeParseJSON<T>(jsonString: string | null, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    return defaultValue;
  }
}

export function safeStringifyJSON(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '{}';
  }
}

// LocalStorage wrappers with error handling
export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return safeParseJSON(item, defaultValue);
  } catch (error) {
    return defaultValue;
  }
}

export function setToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, safeStringifyJSON(value));
    return true;
  } catch (error) {
    return false;
  }
}

export function removeFromStorage(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

// Pet-specific storage helpers
export function getPetFromStorage() {
  return getFromStorage(STORAGE_KEYS.PET, null);
}

export function setPetToStorage(pet: any): boolean {
  return setToStorage(STORAGE_KEYS.PET, pet);
}

export function getTasksFromStorage(): any[] {
  return getFromStorage(STORAGE_KEYS.TASKS, []);
}

export function setTasksToStorage(tasks: any[]): boolean {
  return setToStorage(STORAGE_KEYS.TASKS, tasks);
}

export function getActiveTimerFromStorage() {
  return getFromStorage(STORAGE_KEYS.ACTIVE_TIMER, null);
}

export function setActiveTimerToStorage(timer: any): boolean {
  return setToStorage(STORAGE_KEYS.ACTIVE_TIMER, timer);
}

export function removeActiveTimer(): boolean {
  return removeFromStorage(STORAGE_KEYS.ACTIVE_TIMER);
}

// Additional storage helpers for common patterns
export function getCemeteryFromStorage(): any[] {
  return getFromStorage(STORAGE_KEYS.CEMETERY, []);
}

export function setCemeteryToStorage(cemetery: any[]): boolean {
  return setToStorage(STORAGE_KEYS.CEMETERY, cemetery);
}

export function getCoinsFromStorage(): number {
  return getFromStorage(STORAGE_KEYS.COINS, 50);
}

export function setCoinsToStorage(coins: number): boolean {
  return setToStorage(STORAGE_KEYS.COINS, coins);
}

export function getPauseTokensFromStorage(): number {
  return getFromStorage(STORAGE_KEYS.PAUSE_TOKENS, 0);
}

export function setPauseTokensToStorage(tokens: number): boolean {
  return setToStorage(STORAGE_KEYS.PAUSE_TOKENS, tokens);
}

export function getOwnedItemsFromStorage(): any[] {
  return getFromStorage(STORAGE_KEYS.OWNED_ITEMS, []);
}

export function setOwnedItemsToStorage(items: any[]): boolean {
  return setToStorage(STORAGE_KEYS.OWNED_ITEMS, items);
}

export function getSessionStatsFromStorage(): any {
  return getFromStorage(STORAGE_KEYS.SESSION_STATS, {});
}

export function setSessionStatsToStorage(stats: any): boolean {
  return setToStorage(STORAGE_KEYS.SESSION_STATS, stats);
}

export function getLastCloudSyncFromStorage(): string | null {
  return getFromStorage(STORAGE_KEYS.LAST_CLOUD_SYNC, null);
}

export function setLastCloudSyncToStorage(timestamp: string): boolean {
  return setToStorage(STORAGE_KEYS.LAST_CLOUD_SYNC, timestamp);
}

export function getLastActivityFromStorage(): string | null {
  return getFromStorage(STORAGE_KEYS.LAST_ACTIVITY, null);
}

export function setLastActivityToStorage(timestamp: string): boolean {
  return setToStorage(STORAGE_KEYS.LAST_ACTIVITY, timestamp);
}

export function getInactivityTimeoutsFromStorage(): string[] {
  return getFromStorage(STORAGE_KEYS.INACTIVITY_TIMEOUTS, []);
}

export function setInactivityTimeoutsToStorage(timeouts: string[]): boolean {
  return setToStorage(STORAGE_KEYS.INACTIVITY_TIMEOUTS, timeouts);
}

export function removeInactivityTimeouts(): boolean {
  return removeFromStorage(STORAGE_KEYS.INACTIVITY_TIMEOUTS);
}

export function removeInsurance(): boolean {
  return removeFromStorage(STORAGE_KEYS.INSURANCE);
}

export function getPendingValidationFromStorage() {
  return getFromStorage(STORAGE_KEYS.PENDING_VALIDATION, null);
}

export function setPendingValidationToStorage(validation: any): boolean {
  return setToStorage(STORAGE_KEYS.PENDING_VALIDATION, validation);
}

export function removePendingValidation(): boolean {
  return removeFromStorage(STORAGE_KEYS.PENDING_VALIDATION);
}

export function getPendingShareUrlFromStorage(): string | null {
  return getFromStorage(STORAGE_KEYS.PENDING_SHARE_URL, null);
}

export function setPendingShareUrlToStorage(url: string): boolean {
  return setToStorage(STORAGE_KEYS.PENDING_SHARE_URL, url);
}

export function removePendingShareUrl(): boolean {
  return removeFromStorage(STORAGE_KEYS.PENDING_SHARE_URL);
}

export function getVerificationsFromStorage(): any[] {
  return getFromStorage(STORAGE_KEYS.VERIFICATIONS, []);
}

export function setVerificationsToStorage(verifications: any[]): boolean {
  return setToStorage(STORAGE_KEYS.VERIFICATIONS, verifications);
}

export function removeVerifications(): boolean {
  return removeFromStorage(STORAGE_KEYS.VERIFICATIONS);
}

export function getInsuranceFromStorage(): boolean {
  return getFromStorage(STORAGE_KEYS.INSURANCE, false);
}

export function setInsuranceToStorage(hasInsurance: boolean): boolean {
  return setToStorage(STORAGE_KEYS.INSURANCE, hasInsurance);
}

// Time calculation helpers
export function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

export function msToMinutes(ms: number): number {
  return Math.floor(ms / (60 * 1000));
}

export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

// Timer helpers
export function isTimerActive(timer: any): boolean {
  if (!timer || !timer.startTime) return false;
  
  const now = Date.now();
  const elapsed = (now - timer.startTime) / 1000;
  
  return timer.isRunning && elapsed <= timer.duration * 60;
}

export function isTimerExpired(timer: any): boolean {
  if (!timer || !timer.startTime) return false;
  
  const now = Date.now();
  const elapsed = (now - timer.startTime) / 1000;
  
  return elapsed > timer.duration * 60;
}

export function getTimerElapsed(timer: any): number {
  if (!timer || !timer.startTime) return 0;
  
  const now = Date.now();
  return (now - timer.startTime) / 1000;
}

// Task filtering helpers
export function filterOverdueTasks(tasks: any[], petAdoptedAt?: string): any[] {
  const now = new Date();
  
  return tasks.filter((task: any) => {
    if (task.status === TASK_STATUS.DONE) return false;
    
    // Only check tasks created after pet adoption
    if (petAdoptedAt && new Date(task.createdAt) < new Date(petAdoptedAt)) {
      return false;
    }
    
    if (task.dueDate && task.dueTime) {
      const dueDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
      return dueDateTime < now;
    } else if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(23, 59, 59, 999);
      return dueDate < now;
    }
    
    return false;
  });
}

export function filterTasksByStatus(tasks: any[], status: string): any[] {
  return tasks.filter(task => task.status === status);
}

// Streak calculation helpers
export function shouldResetStreak(lastTaskDate: string): boolean {
  const today = getToday();
  const yesterday = getYesterday();
  
  return lastTaskDate !== today && lastTaskDate !== yesterday;
}

export function updatePetStreak(pet: any): any {
  if (!pet) return pet;
  
  const lastTaskDate = pet.lastTaskDate || '';
  
  if (shouldResetStreak(lastTaskDate) && pet.streak > 0) {
    return { ...pet, streak: 0 };
  }
  
  return pet;
}

// URL helpers
export function validateImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    const supabasePattern = /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/storage\/v1\/object\/sign\//;
    return supabasePattern.test(url);
  } catch (error) {
    return false;
  }
}

// Device detection helpers
export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function supportsNotifications(): boolean {
  return 'Notification' in window;
}

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Array helpers
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getRandomItem<T>(array: T[]): T | undefined {
  return array[Math.floor(Math.random() * array.length)];
}

// Error handling helpers
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return 'An unknown error occurred';
}

// Validation helpers
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

// File size helpers
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function isFileSizeValid(bytes: number, maxBytes: number): boolean {
  return bytes <= maxBytes;
}

// Performance helpers
export function measure<T>(fn: () => T, label?: string): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  if (label && process.env.NODE_ENV === 'development') {
    // Only log in development
  }
  
  return result;
}

// Browser compatibility helpers
export function supportsWebP(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

export function supportsLocalStorage(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}