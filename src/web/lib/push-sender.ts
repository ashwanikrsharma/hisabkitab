import { getActiveTokensForUsers } from '@hisabkitab/services';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

type PushNotificationParams = {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/**
 * Sends push notifications to all active devices for the given user IDs.
 * This function is designed to be called non-blocking (.catch(console.error)).
 * It will never throw — errors are logged internally.
 */
export async function sendPushNotifications(params: PushNotificationParams): Promise<void> {
  const { userIds, title, body, data } = params;

  if (userIds.length === 0) return;

  try {
    const tokens = await getActiveTokensForUsers(userIds);

    if (tokens.length === 0) return;

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data,
      sound: 'default' as const,
    }));

    // Expo recommends batches of up to 100 messages
    const BATCH_SIZE = 100;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);

      const response = await fetch(EXPO_PUSH_API, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error(
          `[push-sender] Expo Push API returned ${response.status}:`,
          await response.text().catch(() => 'unknown'),
        );
      }
    }
  } catch (err) {
    console.error('[push-sender] Failed to send push notifications:', err);
  }
}
