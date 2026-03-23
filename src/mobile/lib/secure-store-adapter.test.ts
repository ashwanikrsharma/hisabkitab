import { SecureStoreAdapter } from './secure-store-adapter';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';

const mockGetItemAsync = SecureStore.getItemAsync as jest.Mock;
const mockSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

describe('SecureStoreAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getItem', () => {
    it('returns the stored value for a given key', async () => {
      mockGetItemAsync.mockResolvedValue('test-session-token');

      const result = await SecureStoreAdapter.getItem('auth-session');

      expect(mockGetItemAsync).toHaveBeenCalledWith('auth-session');
      expect(result).toBe('test-session-token');
    });

    it('returns null when the key does not exist', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const result = await SecureStoreAdapter.getItem('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null when SecureStore throws an error', async () => {
      mockGetItemAsync.mockRejectedValue(new Error('Keychain unavailable'));

      const result = await SecureStoreAdapter.getItem('auth-session');

      expect(result).toBeNull();
    });
  });

  describe('setItem', () => {
    it('stores a value for a given key', async () => {
      mockSetItemAsync.mockResolvedValue(undefined);

      await SecureStoreAdapter.setItem('auth-session', 'new-token');

      expect(mockSetItemAsync).toHaveBeenCalledWith('auth-session', 'new-token');
    });

    it('silently fails when SecureStore throws an error', async () => {
      mockSetItemAsync.mockRejectedValue(new Error('Storage full'));

      // Should not throw
      await expect(
        SecureStoreAdapter.setItem('auth-session', 'new-token'),
      ).resolves.toBeUndefined();
    });
  });

  describe('removeItem', () => {
    it('deletes the value for a given key', async () => {
      mockDeleteItemAsync.mockResolvedValue(undefined);

      await SecureStoreAdapter.removeItem('auth-session');

      expect(mockDeleteItemAsync).toHaveBeenCalledWith('auth-session');
    });

    it('silently fails when SecureStore throws an error', async () => {
      mockDeleteItemAsync.mockRejectedValue(new Error('Key not found'));

      await expect(
        SecureStoreAdapter.removeItem('auth-session'),
      ).resolves.toBeUndefined();
    });
  });
});
