import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user1' } } },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: { synced_at: '2024-01-01T00:00:00.000Z', pet_id: 'abc123' },
      error: null,
    }),
  },
}));

vi.mock('@/store', () => ({
  usePetStore: {
    getState: () => ({
      pet: {
        id: 'pet1',
        name: 'Kiki',
        type: 'cat',
        adoptedAt: 'now',
        streak: 0,
        lastTaskDate: null,
        sessionsCompleted: 0,
        mutations: [],
        usedAdRevival: false,
      },
      coins: 0,
      dna: 0,
      pauseTokens: 0,
      insurance: false,
      equippedItems: {},
      updatePet: vi.fn(),
      setPet: vi.fn(),
      setCoins: vi.fn(),
      setDna: vi.fn(),
      setPauseTokens: vi.fn(),
      setInsurance: vi.fn(),
      removeItem: vi.fn(),
      equipItem: vi.fn(),
    }),
  },
  useTimerStore: {
    getState: () => ({
      sessionStats: {
        totalSessions: 0,
        pausesUsed: 0,
        totalFocusTime: 0,
        averageSessionLength: 0,
        longestSession: 0,
        tasksCompleted: 0,
        lastSessionDate: null,
      },
      updateSessionStats: vi.fn(),
    }),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/utils/helpers', () => ({
  setLastCloudSyncToStorage: vi.fn(),
}));

import { uploadKikiToCloud } from '../kikisync';
import { setLastCloudSyncToStorage } from '@/utils/helpers';

describe('kikisync', () => {
  test('uploadKikiToCloud stores sync time on success', async () => {
    const result = await uploadKikiToCloud();
    expect(result.success).toBe(true);
    expect(setLastCloudSyncToStorage).toHaveBeenCalledWith('2024-01-01T00:00:00.000Z');
  });
});
