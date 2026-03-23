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

  it('renders the profile screen with Name field', async () => {
    const { getByText } = renderWithProviders(<ProfileScreen />);
    await waitFor(() => {
      expect(getByText('Profile')).toBeTruthy();
      expect(getByText('Name')).toBeTruthy();
    });
  });

  it('does NOT render UPI ID field (regression: removed)', async () => {
    const { queryByText } = renderWithProviders(<ProfileScreen />);
    await waitFor(() => {
      expect(queryByText('Profile')).toBeTruthy();
    });
    // UPI ID was removed from the profile screen
    expect(queryByText('UPI ID')).toBeNull();
    expect(queryByText(/upi/i)).toBeNull();
  });

  it('does NOT render currency selector (regression: removed)', async () => {
    const { queryByText } = renderWithProviders(<ProfileScreen />);
    await waitFor(() => {
      expect(queryByText('Profile')).toBeTruthy();
    });
    // Currency selector was removed from the profile screen
    expect(queryByText('Currency')).toBeNull();
    expect(queryByText('Default Currency')).toBeNull();
  });

  it('shows Save button when name is edited (dirty state)', async () => {
    const { queryByText, getByText, getByPlaceholderText } = renderWithProviders(
      <ProfileScreen />,
    );
    await waitFor(() => {
      expect(getByText('Profile')).toBeTruthy();
    });

    // Save button should not be visible initially
    expect(queryByText('Save Changes')).toBeNull();

    // Edit the name using the placeholder to locate the input
    const nameInput = getByPlaceholderText('Your name');
    fireEvent.changeText(nameInput, 'New Name');

    // Save button should now be visible
    await waitFor(() => {
      expect(queryByText('Save Changes')).toBeTruthy();
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
