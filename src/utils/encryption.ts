/**
 * Encryption utilities for sensitive local data
 * Uses Web Crypto API for secure client-side encryption
 */

interface EncryptedData {
  encryptedData: string;
  iv: string;
  salt: string;
}

class LocalEncryption {
  private static instance: LocalEncryption;
  private key: CryptoKey | null = null;

  static getInstance(): LocalEncryption {
    if (!LocalEncryption.instance) {
      LocalEncryption.instance = new LocalEncryption();
    }
    return LocalEncryption.instance;
  }

  /**
   * Generate or retrieve encryption key
   */
  private async getKey(): Promise<CryptoKey> {
    if (this.key) {
      return this.key;
    }

    // Try to get existing key from secure storage
    const existingKeyData = localStorage.getItem('kiki-encryption-key');
    
    if (existingKeyData) {
      try {
        const keyData = JSON.parse(existingKeyData);
        this.key = await crypto.subtle.importKey(
          'jwk',
          keyData,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
        return this.key;
      } catch (error) {
        console.warn('Failed to import existing key, generating new one');
      }
    }

    // Generate new key
    this.key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // Store key for future use
    const exportedKey = await crypto.subtle.exportKey('jwk', this.key);
    localStorage.setItem('kiki-encryption-key', JSON.stringify(exportedKey));

    return this.key;
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(data: string): Promise<EncryptedData> {
    try {
      const key = await this.getKey();
      const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM needs 12 bytes
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      const encodedData = new TextEncoder().encode(data);
      
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encodedData
      );

      return {
        encryptedData: this.arrayBufferToBase64(encryptedBuffer),
        iv: this.arrayBufferToBase64(iv),
        salt: this.arrayBufferToBase64(salt)
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    try {
      const key = await this.getKey();
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const data = this.base64ToArrayBuffer(encryptedData.encryptedData);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Securely store encrypted data in localStorage
   */
  async setSecureItem(key: string, value: string): Promise<void> {
    try {
      const encrypted = await this.encrypt(value);
      localStorage.setItem(`kiki-secure-${key}`, JSON.stringify(encrypted));
    } catch (error) {
      console.error('Failed to store secure item:', error);
      // Fallback to regular storage (with warning)
      console.warn('Falling back to unencrypted storage for:', key);
      localStorage.setItem(key, value);
    }
  }

  /**
   * Retrieve and decrypt data from localStorage
   */
  async getSecureItem(key: string): Promise<string | null> {
    try {
      const encryptedData = localStorage.getItem(`kiki-secure-${key}`);
      if (!encryptedData) {
        // Check for fallback unencrypted data
        return localStorage.getItem(key);
      }

      const parsed = JSON.parse(encryptedData);
      return await this.decrypt(parsed);
    } catch (error) {
      console.error('Failed to retrieve secure item:', error);
      // Fallback to regular storage
      return localStorage.getItem(key);
    }
  }

  /**
   * Remove encrypted data
   */
  removeSecureItem(key: string): void {
    localStorage.removeItem(`kiki-secure-${key}`);
    localStorage.removeItem(key); // Also remove fallback
  }

  /**
   * Clear all encrypted data
   */
  clearAllSecureData(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('kiki-secure-') || key === 'kiki-encryption-key') {
        localStorage.removeItem(key);
      }
    });
    this.key = null;
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Export singleton instance
export const encryption = LocalEncryption.getInstance();

// Export types
export type { EncryptedData };

/**
 * Utility functions for common use cases
 */
export const secureStorage = {
  /**
   * Store sensitive data encrypted
   */
  setItem: (key: string, value: string): Promise<void> => {
    return encryption.setSecureItem(key, value);
  },

  /**
   * Retrieve sensitive data decrypted
   */
  getItem: (key: string): Promise<string | null> => {
    return encryption.getSecureItem(key);
  },

  /**
   * Remove sensitive data
   */
  removeItem: (key: string): void => {
    encryption.removeSecureItem(key);
  },

  /**
   * Store JSON data encrypted
   */
  setJSON: async (key: string, value: any): Promise<void> => {
    const jsonString = JSON.stringify(value);
    return encryption.setSecureItem(key, jsonString);
  },

  /**
   * Retrieve JSON data decrypted
   */
  getJSON: async (key: string): Promise<any> => {
    const jsonString = await encryption.getSecureItem(key);
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Failed to parse JSON from secure storage:', error);
      return null;
    }
  }
};

/**
 * List of sensitive data keys that should be encrypted
 */
export const SENSITIVE_KEYS = [
  'kiki-pet',           // Pet data contains emotional state
  'kiki-session-stats', // Usage statistics
  'kiki-coins',         // Virtual currency
  'kiki-pause-tokens',  // Gaming tokens
  'kiki-insurance',     // Insurance data
  'kiki-owned-items',   // Purchase history
  'kiki-last-activity', // Activity tracking
  'kiki-guest-id',      // Guest identification
] as const;

/**
 * Migrate existing unencrypted data to encrypted storage
 */
export const migrateToEncryptedStorage = async (): Promise<void> => {
  console.log('🔐 Migrating sensitive data to encrypted storage...');
  
  for (const key of SENSITIVE_KEYS) {
    try {
      const existingData = localStorage.getItem(key);
      if (existingData && !localStorage.getItem(`kiki-secure-${key}`)) {
        // Data exists unencrypted and not yet migrated
        await secureStorage.setItem(key, existingData);
        localStorage.removeItem(key); // Remove unencrypted version
        console.log(`✅ Migrated ${key} to encrypted storage`);
      }
    } catch (error) {
      console.error(`Failed to migrate ${key}:`, error);
    }
  }
  
  console.log('🔐 Migration to encrypted storage completed');
};