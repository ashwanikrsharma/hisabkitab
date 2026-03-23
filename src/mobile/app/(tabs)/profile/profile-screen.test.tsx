// Mock dependencies before imports

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
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

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('react-native-url-polyfill/auto', () => ({}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name, ...props }: any) => <Text>{name}</Text>,
  };
});

const mockSignOut = jest.fn().mockResolvedValue({ error: null });
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      signOut: (...args: any[]) => mockSignOut(...args),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  }),
}));

jest.mock('../../../lib/local-db', () => ({
  getLocalUser: jest.fn().mockResolvedValue({
    id: 'user-1',
    name: 'Test User',
    upi_id: 'test@upi',
    default_currency: 'INR',
  }),
}));

jest.mock('../../../lib/sync-engine', () => ({
  triggerSync: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useAuthStore } from '../../../store/auth';
import ProfileScreen from './index';

// Spy on Alert.alert
jest.spyOn(Alert, 'alert');

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      session: {
        access_token: 'test-token',
        user: { id: 'user-1', email: 'test@example.com' },
      } as any,
      loading: false,
    });
  });

  it('renders the profile screen', async () => {
    const { getByText } = renderWithProviders(<ProfileScreen />);
    await waitFor(() => {
      expect(getByText('Profile')).toBeTruthy();
    });
  });

  it('renders sign out button', async () => {
    const { getByText } = renderWithProviders(<ProfileScreen />);
    await waitFor(() => {
      expect(getByText('Sign Out')).toBeTruthy();
    });
  });

  it('shows confirmation alert when sign out is pressed', async () => {
    const { getByText } = renderWithProviders(<ProfileScreen />);
    await waitFor(() => getByText('Sign Out'));

    fireEvent.press(getByText('Sign Out'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Sign Out',
      'Are you sure you want to sign out?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Sign Out', style: 'destructive' }),
      ]),
    );
  });

  it('navigates to login after confirming sign out', async () => {
    const { getByText } = renderWithProviders(<ProfileScreen />);
    await waitFor(() => getByText('Sign Out'));

    fireEvent.press(getByText('Sign Out'));

    // Extract the onPress from the destructive button
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const signOutButton = buttons.find(
      (b: { text: string }) => b.text === 'Sign Out',
    );

    await act(async () => {
      await signOutButton.onPress();
    });

    expect(useAuthStore.getState().session).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('navigates to login even when signOut API fails', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('Network error'));

    const { getByText } = renderWithProviders(<ProfileScreen />);
    await waitFor(() => getByText('Sign Out'));

    fireEvent.press(getByText('Sign Out'));

    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const signOutButton = buttons.find(
      (b: { text: string }) => b.text === 'Sign Out',
    );

    await act(async () => {
      await signOutButton.onPress();
    });

    // Should still navigate even on API failure
    expect(useAuthStore.getState().session).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});
