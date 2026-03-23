import { getServerClient } from '../client';
import type { User } from '../types';

/**
 * Returns a user profile by ID.
 * Returns null if the user does not exist.
 */
export async function getUserProfile(userId: string): Promise<User | null> {
  const db = getServerClient();

  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // PostgREST returns PGRST116 when no rows found — treat as null
    if (error.code === 'PGRST116') return null;
    throw new Error(`getUserProfile: ${error.message}`);
  }

  return data as User;
}

/**
 * Upserts a user profile. Creates a new record or updates existing fields.
 * Used on first sign-in to ensure a users row exists.
 */
export async function upsertUser(
  userId: string,
  data: {
    phone?: string;
    name?: string;
    avatar_url?: string;
    upi_id?: string;
    default_currency?: string;
  },
): Promise<User> {
  const db = getServerClient();

  const { data: user, error } = await db
    .from('users')
    .upsert(
      {
        id: userId,
        phone: data.phone ?? '',
        name: data.name ?? '',
        avatar_url: data.avatar_url ?? null,
        upi_id: data.upi_id ?? null,
        default_currency: data.default_currency ?? 'INR',
      },
      { onConflict: 'id' },
    )
    .select()
    .single();

  if (error) throw new Error(`upsertUser: ${error.message}`);
  if (!user) throw new Error('upsertUser: no data returned');

  return user as User;
}

/**
 * Updates mutable profile fields for a user.
 * Does not allow changing phone (auth concern) or id.
 */
export async function updateUserProfile(
  userId: string,
  data: {
    name?: string;
    avatar_url?: string;
    upi_id?: string;
    default_currency?: string;
  },
): Promise<User> {
  const db = getServerClient();

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.avatar_url !== undefined) updatePayload.avatar_url = data.avatar_url;
  if (data.upi_id !== undefined) updatePayload.upi_id = data.upi_id;
  if (data.default_currency !== undefined) updatePayload.default_currency = data.default_currency;

  const { data: user, error } = await db
    .from('users')
    .update(updatePayload)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(`updateUserProfile: ${error.message}`);
  if (!user) throw new Error('updateUserProfile: no data returned');

  return user as User;
}
