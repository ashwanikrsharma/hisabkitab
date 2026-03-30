import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from './api-client';

// Configure how notifications are presented when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Requests push notification permissions, retrieves an Expo push token,
 * and registers it with the backend API. Returns the token string on success,
 * or null if permissions are denied or registration fails.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // 1. Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.error('[notifications] Push notification permission not granted');
      return null;
    }

    // 2. Get Expo push token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

    if (!projectId) {
      console.error('[notifications] Missing EAS projectId in app config');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // 3. Determine platform
    const platform: 'ios' | 'android' | 'web' =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    // 4. Register token with the backend
    await apiClient('/api/push-tokens', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });

    return token;
  } catch (err) {
    console.error('[notifications] Failed to register for push notifications:', err);
    return null;
  }
}

/**
 * Deactivates a push token on the backend (e.g., on logout).
 * Non-fatal — errors are logged but not thrown.
 */
export async function deactivatePushNotification(token: string): Promise<void> {
  try {
    await apiClient('/api/push-tokens', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.error('[notifications] Failed to deactivate push token:', err);
  }
}
