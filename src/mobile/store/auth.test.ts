// Mock dependencies before importing the module under test

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
      },
    },
  },
}));

jest.mock('react-native-url-polyfill/auto', () => ({}));

// Use module-level variables that jest.mock factory can close over
const mockGetSession = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChange = jest.fn(() => ({
  data: { subscription: { unsubscribe: jest.fn() } },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
    },
  }),
}));

import { useAuthStore } from './auth';

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the zustand store to initial state
    useAuthStore.setState({ session: null, loading: true });
  });

  describe('initial state', () => {
    it('has session as null', () => {
      const state = useAuthStore.getState();
      expect(state.session).toBeNull();
    });

    it('has loading as true', () => {
      const state = useAuthStore.getState();
      expect(state.loading).toBe(true);
    });
  });

  describe('checkSession', () => {
    it('sets session and loading false when session exists', async () => {
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'user-1', email: 'test@example.com' },
      };
      mockGetSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.loading).toBe(false);
    });

    it('sets session null and loading false when no session', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.session).toBeNull();
      expect(state.loading).toBe(false);
    });

    it('sets session null and loading false on error', async () => {
      mockGetSession.mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.session).toBeNull();
      expect(state.loading).toBe(false);
    });

    it('subscribes to auth state changes after getting session', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await useAuthStore.getState().checkSession();

      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('clears session on successful sign out', async () => {
      // Set an active session first
      useAuthStore.setState({
        session: { access_token: 'token' } as any,
        loading: false,
      });

      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().signOut();

      expect(mockSignOut).toHaveBeenCalled();
      expect(useAuthStore.getState().session).toBeNull();
    });

    it('sets session null even when the API call fails', async () => {
      useAuthStore.setState({
        session: { access_token: 'token' } as any,
        loading: false,
      });

      mockSignOut.mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().signOut();

      // Should still clear local session even on error
      expect(useAuthStore.getState().session).toBeNull();
    });
  });
});
