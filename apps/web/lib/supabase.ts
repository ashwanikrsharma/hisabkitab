import { createBrowserClient } from '@supabase/ssr';

/**
 * Returns a Supabase browser client for use in Client Components.
 * Reads NEXT_PUBLIC_* env vars automatically.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
