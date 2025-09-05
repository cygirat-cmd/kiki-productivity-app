/**
 * Tests for the refactored proof upload system
 * Tests auth.uid() integration, Storage uploads, and RLS compliance
 */

import { saveVerificationFromBase64, getVerificationImageSrc, syncVerificationToCloud } from '../proofs';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase for tests
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: jest.fn()
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        createSignedUrl: jest.fn(),
        remove: jest.fn()
      }))
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }
}));

const mockSupabase = supabase as any;

describe('Proof Upload System', () => {
  const mockUser = {
    id: 'test-uid-123',
    email: 'test@example.com'
  };

  const mockBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveVerificationFromBase64', () => {
    test('should upload with proper auth.uid() as user_id and storage path', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock successful storage upload
      mockSupabase.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: `${mockUser.id}/task_test_1234567890.jpg` },
          error: null
        })
      });

      // Mock successful DB insert
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'verification-123',
                user_id: mockUser.id,
                task: 'test',
                photo_storage_path: `${mockUser.id}/task_test_1234567890.jpg`,
                status: 'pending'
              },
              error: null
            })
          })
        })
      });

      const result = await saveVerificationFromBase64({
        taskId: 'test',
        base64: mockBase64
      });

      expect(result.verificationId).toBeDefined();
      expect(result.storagePath).toMatch(new RegExp(`^${mockUser.id}/task_test_\\d+\\.jpg$`));

      // Verify Storage upload was called with correct path format
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('proofs');
      
      // Verify DB insert was called with user_id = auth.uid()
      const insertCall = mockSupabase.from().insert.mock.calls[0][0];
      expect(insertCall.user_id).toBe(mockUser.id);
      expect(insertCall.photo_storage_path).toMatch(new RegExp(`^${mockUser.id}/`));
      expect(insertCall.photo).toBeUndefined(); // NEVER insert photo field
    });

    test('should fail when user not authenticated', async () => {
      // Mock unauthenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      });

      await expect(saveVerificationFromBase64({
        taskId: 'test',
        base64: mockBase64
      })).rejects.toThrow('User must be authenticated to upload proofs');
    });

    test('should cleanup storage on DB insert failure', async () => {
      // Mock authenticated user and successful upload
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockRemove = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: `${mockUser.id}/task_test_1234567890.jpg` },
          error: null
        }),
        remove: mockRemove
      });

      // Mock DB insert failure
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'RLS policy violation' }
            })
          })
        })
      });

      await expect(saveVerificationFromBase64({
        taskId: 'test',
        base64: mockBase64
      })).rejects.toThrow('Database insert failed');

      // Verify cleanup was called
      expect(mockRemove).toHaveBeenCalledWith([`${mockUser.id}/task_test_1234567890.jpg`]);
    });
  });

  describe('getVerificationImageSrc', () => {
    test('should create signed URL for storage path', async () => {
      const mockSignedUrl = 'https://supabase.storage/signed-url-123';
      
      mockSupabase.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: mockSignedUrl },
          error: null
        })
      });

      const row = {
        photo_storage_path: 'user123/task_test_1234567890.jpg'
      };

      const result = await getVerificationImageSrc(row);

      expect(result).toBe(mockSignedUrl);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('proofs');
    });

    test('should return legacy base64 as fallback', async () => {
      const legacyBase64 = 'data:image/jpeg;base64,abcd1234';
      const row = {
        photo: legacyBase64
      };

      const result = await getVerificationImageSrc(row);

      expect(result).toBe(legacyBase64);
    });

    test('should add data URL prefix for raw base64', async () => {
      const rawBase64 = 'abcd1234';
      const row = {
        photo: rawBase64
      };

      const result = await getVerificationImageSrc(row);

      expect(result).toBe(`data:image/jpeg;base64,${rawBase64}`);
    });

    test('should return null when no image source available', async () => {
      const row = {};

      const result = await getVerificationImageSrc(row);

      expect(result).toBeNull();
    });
  });

  describe('syncVerificationToCloud', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });
    });

    test('should convert legacy base64 to Storage format', async () => {
      // Mock saveVerificationFromBase64 success
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: `${mockUser.id}/task_test_1234567890.jpg` },
        error: null
      });

      mockSupabase.storage.from.mockReturnValue({
        upload: mockUpload
      });

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'verification-123' },
              error: null
            })
          })
        })
      });

      const legacyVerification = {
        id: 'legacy-123',
        task: 'exercise',
        photo: mockBase64, // Legacy base64
        status: 'pending'
      };

      await syncVerificationToCloud(legacyVerification);

      // Should have converted to Storage
      expect(mockUpload).toHaveBeenCalled();
    });

    test('should insert clean data without photo field for new format', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      
      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      });

      const newFormatVerification = {
        id: 'new-123',
        task: 'exercise',
        photo_storage_path: `${mockUser.id}/task_exercise_1234567890.jpg`,
        status: 'pending',
        photo: 'should-be-removed' // This should be stripped
      };

      await syncVerificationToCloud(newFormatVerification);

      expect(mockInsert).toHaveBeenCalled();
      const insertedData = mockInsert.mock.calls[0][0];
      expect(insertedData.photo).toBeUndefined(); // Should be removed
      expect(insertedData.user_id).toBe(mockUser.id); // Should be set to auth.uid()
      expect(insertedData.photo_storage_path).toBe(newFormatVerification.photo_storage_path);
    });
  });

  describe('File extension handling', () => {
    test('should handle different MIME types correctly', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: `${mockUser.id}/task_test_1234567890.png` },
        error: null
      });

      mockSupabase.storage.from.mockReturnValue({
        upload: mockUpload
      });

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'verification-123' },
              error: null
            })
          })
        })
      });

      await saveVerificationFromBase64({
        taskId: 'test',
        base64: 'data:image/png;base64,test',
        mime: 'image/png'
      });

      const uploadCall = mockUpload.mock.calls[0];
      const storagePath = uploadCall[0];
      expect(storagePath).toMatch(/\.png$/);
    });
  });
});