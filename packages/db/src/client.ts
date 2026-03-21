import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// ─── Server-Side Client (Service Role) ───────────────────────────────────────
// ONLY use in API routes (server-side). NEVER expose to client.
// Service role bypasses RLS — use only when necessary (e.g., admin tasks).

let _serverClient: SupabaseClient<Database> | null = null;

/**
 * Returns a Supabase client with service role privileges.
 * SECURITY: Only call from server-side API routes. Never expose to client.
 */
export function getServerClient(): SupabaseClient<Database> {
  if (_serverClient) return _serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.',
    );
  }

  _serverClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _serverClient;
}

// ─── Anon Client (for use with RLS) ──────────────────────────────────────────
// Use this in queries where you want Supabase RLS to apply.
// Pass the user's JWT to scope queries to their permissions.

let _anonClient: SupabaseClient<Database> | null = null;

/**
 * Returns a Supabase client using the anon key (respects RLS).
 * For queries scoped to a user, use getAuthedClient(accessToken) instead.
 */
export function getAnonClient(): SupabaseClient<Database> {
  if (_anonClient) return _anonClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.',
    );
  }

  _anonClient = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _anonClient;
}

/**
 * Returns a Supabase client authenticated with the user's JWT.
 * Respects RLS. Use in server-side contexts where you have the user's access token.
 */
export function getAuthedClient(accessToken: string): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.',
    );
  }

  // Create a new client per request with the user's token
  return createClient<Database>(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
