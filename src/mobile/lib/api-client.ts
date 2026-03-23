import Constants from 'expo-constants';
import { useAuthStore } from '../store/auth';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'https://hisabkitab-five.vercel.app';

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

/**
 * Centralized API client. Automatically attaches Bearer token and base URL.
 * Throws on non-OK responses with the server error message.
 */
export async function apiClient<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const session = useAuthStore.getState().session;
  const accessToken = session?.access_token;

  const headers: Record<string, string> = {
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      (errorData as { error?: string }).error ??
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
