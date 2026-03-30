import { getServerClient } from '../client';
import type { PushToken, PushTokenPlatform } from '../types';

/**
 * Registers (upserts) a push notification token for a user.
 * If the same (user_id, token) pair already exists, updates platform, device_id,
 * and re-activates the token.
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: PushTokenPlatform,
  deviceId?: string,
): Promise<PushToken> {
  const db = getServerClient();

  const { data, error } = await db
    .from('push_tokens')
    .upsert(
      {
        user_id: userId,
        token,
        platform,
        device_id: deviceId ?? null,
        is_active: true,
      },
      { onConflict: 'user_id,token' },
    )
    .select()
    .single();

  if (error) throw new Error(`registerPushToken: ${error.message}`);
  if (!data) throw new Error('registerPushToken: no data returned');

  return data as unknown as PushToken;
}

/**
 * Deactivates a push token for a user (e.g., on logout).
 * Sets is_active = false rather than deleting the row.
 */
export async function deactivatePushToken(
  userId: string,
  token: string,
): Promise<void> {
  const db = getServerClient();

  const { error } = await db
    .from('push_tokens')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('token', token);

  if (error) throw new Error(`deactivatePushToken: ${error.message}`);
}

/**
 * Retrieves all active push tokens for a list of user IDs.
 * Used by the push notification sender to look up tokens for target users.
 */
export async function getActiveTokensForUsers(
  userIds: string[],
): Promise<PushToken[]> {
  if (userIds.length === 0) return [];

  const db = getServerClient();

  const { data, error } = await db
    .from('push_tokens')
    .select('*')
    .in('user_id', userIds)
    .eq('is_active', true);

  if (error) throw new Error(`getActiveTokensForUsers: ${error.message}`);

  return (data ?? []) as unknown as PushToken[];
}
