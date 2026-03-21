import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Requires an authenticated user for the current request.
 * Call this at the top of every protected API route.
 *
 * Supports two auth flows:
 * 1. **Cookie-based** (web) — reads Supabase session cookies set by the browser.
 * 2. **Bearer token** (mobile) — reads `Authorization: Bearer <access_token>` header.
 *
 * Cookie auth is attempted first. If no valid cookie session is found the
 * function falls back to Bearer token auth. If neither succeeds a 401
 * JSON response is thrown.
 *
 * @throws {Response} 401 JSON response if no valid session.
 * @returns The authenticated Supabase User object.
 *
 * @example
 * export async function POST(req: Request) {
 *   const user = await requireAuth(req);
 *   // ... rest of handler
 * }
 */
export async function requireAuth(req?: Request): Promise<User> {
  // --- 1. Try cookie-based auth (web) ---
  const cookieUser = await tryGetCookieUser();
  if (cookieUser) {
    return cookieUser;
  }

  // --- 2. Fallback: Bearer token auth (mobile) ---
  if (req) {
    const bearerUser = await tryGetBearerUser(req);
    if (bearerUser) {
      return bearerUser;
    }
  }

  throw Response.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Attempts to authenticate via Supabase session cookies (web flow).
 * Returns the user if a valid cookie session exists, or null otherwise.
 */
async function tryGetCookieUser(): Promise<User | null> {
  try {
    const cookieStore = cookies();

    const supabase = createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {
              // setAll called from Server Component — cookies cannot be set in this context
            }
          },
        },
      },
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    // cookies() can throw when called outside of a request context
    return null;
  }
}

/**
 * Attempts to authenticate via a Bearer token in the Authorization header
 * (mobile flow). Creates a Supabase client scoped to the provided token
 * and verifies it with `getUser()`.
 */
async function tryGetBearerUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) {
    return null;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
