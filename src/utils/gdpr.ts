/**
 * GDPR Compliance utilities
 * Provides data export and deletion functionality
 */

import { supabase } from '@/lib/supabaseClient';
import { secureStorage, SENSITIVE_KEYS } from './encryption';

interface UserDataExport {
  exportDate: string;
  userId: string;
  personalData: {
    profile?: any;
    preferences?: any;
  };
  gameData: {
    pet?: any;
    tasks?: any[];
    stats?: any;
    achievements?: any;
    coins?: number;
    ownedItems?: any[];
  };
  verificationData: {
    verifications?: any[];
    guestUploads?: any[];
  };
  metadata: {
    accountCreated?: string;
    lastActivity?: string;
    dataVersion: string;
  };
}

interface DataDeletionResult {
  success: boolean;
  deletedItems: string[];
  errors: string[];
  cloudDataDeleted: boolean;
  localDataDeleted: boolean;
}

export class GDPRCompliance {
  private static instance: GDPRCompliance;

  static getInstance(): GDPRCompliance {
    if (!GDPRCompliance.instance) {
      GDPRCompliance.instance = new GDPRCompliance();
    }
    return GDPRCompliance.instance;
  }

  /**
   * Export all user data in JSON format (GDPR Article 20 - Right to data portability)
   */
  async exportUserData(): Promise<UserDataExport> {
    console.log('📊 Starting GDPR data export...');

    const exportData: UserDataExport = {
      exportDate: new Date().toISOString(),
      userId: 'local-user', // Will be updated if authenticated
      personalData: {},
      gameData: {},
      verificationData: {},
      metadata: {
        dataVersion: '1.0.0'
      }
    };

    try {
      // Get authenticated user info if available
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        exportData.userId = user.id;
        exportData.personalData.profile = {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at
        };
      }

      // Export local game data (both encrypted and regular)
      exportData.gameData = await this.exportLocalGameData();

      // Export cloud verification data if authenticated
      if (user) {
        exportData.verificationData = await this.exportCloudVerificationData(user.id);
      }

      // Add metadata
      const lastActivity = localStorage.getItem('kiki-last-activity');
      if (lastActivity) {
        exportData.metadata.lastActivity = lastActivity;
      }

      console.log('✅ GDPR data export completed');
      return exportData;

    } catch (error) {
      console.error('Failed to export user data:', error);
      throw new Error('Data export failed');
    }
  }

  /**
   * Export local game data from localStorage and encrypted storage
   */
  private async exportLocalGameData(): Promise<any> {
    const gameData: any = {};

    // Export regular localStorage items
    const regularKeys = [
      'kiki-tasks',
      'kiki-active-timer',
      'kiki-pending-validation',
      'kiki-cemetery',
      'kiki-last-cloud-sync'
    ];

    for (const key of regularKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          gameData[key.replace('kiki-', '')] = JSON.parse(data);
        } catch {
          gameData[key.replace('kiki-', '')] = data;
        }
      }
    }

    // Export encrypted sensitive data
    for (const key of SENSITIVE_KEYS) {
      try {
        const data = await secureStorage.getJSON(key);
        if (data) {
          gameData[key.replace('kiki-', '')] = data;
        }
      } catch (error) {
        console.warn(`Failed to export encrypted data for ${key}:`, error);
      }
    }

    return gameData;
  }

  /**
   * Export cloud verification data
   */
  private async exportCloudVerificationData(userId: string): Promise<any> {
    const verificationData: any = {};

    try {
      // Export verifications
      const { data: verifications } = await supabase
        .from('verifications')
        .select('*')
        .eq('user_id', userId);

      if (verifications) {
        verificationData.verifications = verifications.map(v => ({
          ...v,
          // Remove sensitive file paths for privacy
          photo_storage_path: v.photo_storage_path ? '[FILE_PATH_REDACTED]' : null
        }));
      }

      // Export guest uploads if any
      const { data: guestUploads } = await supabase
        .from('guest_uploads')
        .select('*')
        .eq('user_id', userId);

      if (guestUploads) {
        verificationData.guestUploads = guestUploads;
      }

    } catch (error) {
      console.error('Failed to export cloud verification data:', error);
    }

    return verificationData;
  }

  /**
   * Download exported data as JSON file
   */
  downloadDataExport(exportData: UserDataExport, filename?: string): void {
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `kiki-data-export-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    console.log('📥 Data export downloaded');
  }

  /**
   * Delete all user data (GDPR Article 17 - Right to erasure)
   */
  async deleteAllUserData(confirmationPhrase: string): Promise<DataDeletionResult> {
    if (confirmationPhrase !== 'DELETE ALL MY DATA') {
      throw new Error('Invalid confirmation phrase');
    }

    console.log('🗑️ Starting GDPR data deletion...');

    const result: DataDeletionResult = {
      success: false,
      deletedItems: [],
      errors: [],
      cloudDataDeleted: false,
      localDataDeleted: false
    };

    try {
      // Delete cloud data if authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await this.deleteCloudUserData(user.id, result);
      }

      // Delete all local data
      await this.deleteLocalUserData(result);

      // Clear auth session
      await supabase.auth.signOut();
      result.deletedItems.push('auth_session');

      result.success = result.errors.length === 0;
      
      console.log('🗑️ GDPR data deletion completed:', result);
      return result;

    } catch (error) {
      console.error('Failed to delete user data:', error);
      result.errors.push(`General deletion error: ${error.message}`);
      return result;
    }
  }

  /**
   * Delete cloud user data
   */
  private async deleteCloudUserData(userId: string, result: DataDeletionResult): Promise<void> {
    try {
      // Delete verifications and associated storage files
      const { data: verifications } = await supabase
        .from('verifications')
        .select('photo_storage_path')
        .eq('user_id', userId);

      if (verifications && verifications.length > 0) {
        // Delete storage files
        const filePaths = verifications
          .filter(v => v.photo_storage_path)
          .map(v => v.photo_storage_path);

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('proofs')
            .remove(filePaths);

          if (storageError) {
            result.errors.push(`Storage deletion error: ${storageError.message}`);
          } else {
            result.deletedItems.push(`${filePaths.length} storage files`);
          }
        }

        // Delete verification records
        const { error: verificationError } = await supabase
          .from('verifications')
          .delete()
          .eq('user_id', userId);

        if (verificationError) {
          result.errors.push(`Verification deletion error: ${verificationError.message}`);
        } else {
          result.deletedItems.push(`${verifications.length} verifications`);
        }
      }

      // Delete guest uploads
      const { error: guestError } = await supabase
        .from('guest_uploads')
        .delete()
        .eq('user_id', userId);

      if (guestError) {
        result.errors.push(`Guest uploads deletion error: ${guestError.message}`);
      } else {
        result.deletedItems.push('guest_uploads');
      }

      result.cloudDataDeleted = true;

    } catch (error) {
      result.errors.push(`Cloud deletion error: ${error.message}`);
    }
  }

  /**
   * Delete all local user data
   */
  private async deleteLocalUserData(result: DataDeletionResult): Promise<void> {
    try {
      // Get all localStorage keys that belong to Kiki
      const allKeys = Object.keys(localStorage);
      const kikiKeys = allKeys.filter(key => 
        key.startsWith('kiki-') || 
        key.startsWith('kiki-secure-') ||
        key === 'kiki-encryption-key'
      );

      // Clear all Kiki-related localStorage
      kikiKeys.forEach(key => {
        localStorage.removeItem(key);
        result.deletedItems.push(key);
      });

      // Clear any cached data
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (cacheName.includes('kiki')) {
            await caches.delete(cacheName);
            result.deletedItems.push(`cache: ${cacheName}`);
          }
        }
      }

      // Clear IndexedDB if used
      if ('indexedDB' in window) {
        try {
          // This is a basic cleanup - adjust based on actual IndexedDB usage
          const deleteIDBRequest = indexedDB.deleteDatabase('kiki-app');
          deleteIDBRequest.onsuccess = () => {
            result.deletedItems.push('indexedDB: kiki-app');
          };
        } catch (error) {
          result.errors.push(`IndexedDB deletion error: ${error.message}`);
        }
      }

      result.localDataDeleted = true;

    } catch (error) {
      result.errors.push(`Local deletion error: ${error.message}`);
    }
  }

  /**
   * Generate privacy report
   */
  async generatePrivacyReport(): Promise<string> {
    const report = [];
    
    report.push('KIKI APP - PRIVACY REPORT');
    report.push('Generated: ' + new Date().toLocaleString());
    report.push('');
    
    // Data collection summary
    report.push('DATA COLLECTION SUMMARY:');
    report.push('• Local game data (tasks, pet status, statistics)');
    report.push('• Verification images (for task completion proof)');
    report.push('• Usage analytics (session duration, task completion)');
    report.push('• Account data (if logged in via Supabase Auth)');
    report.push('');
    
    // Data storage locations
    report.push('DATA STORAGE LOCATIONS:');
    report.push('• Local: Browser localStorage (encrypted sensitive data)');
    report.push('• Cloud: Supabase database and storage (if authenticated)');
    report.push('');
    
    // Data retention
    report.push('DATA RETENTION:');
    report.push('• Verification images: Auto-deleted after 7 days');
    report.push('• Local game data: Retained until manual deletion');
    report.push('• Account data: Retained until account deletion');
    report.push('');
    
    // User rights
    report.push('YOUR RIGHTS (GDPR):');
    report.push('• Right to access: Export all your data');
    report.push('• Right to erasure: Delete all your data');
    report.push('• Right to portability: Download data in JSON format');
    report.push('• Right to rectification: Modify your data');
    
    return report.join('\n');
  }
}

// Export singleton instance
export const gdprCompliance = GDPRCompliance.getInstance();

// Convenience functions
export const exportUserData = () => gdprCompliance.exportUserData();
export const deleteAllUserData = (confirmation: string) => gdprCompliance.deleteAllUserData(confirmation);
export const downloadDataExport = (data: UserDataExport, filename?: string) => gdprCompliance.downloadDataExport(data, filename);
export const generatePrivacyReport = () => gdprCompliance.generatePrivacyReport();