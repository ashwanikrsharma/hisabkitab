import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getServerClient } from '@hisabkitab/services';

/**
 * Sanitizes a string for use in PostgREST filter values.
 * Escapes characters that have special meaning in PostgREST filter syntax.
 */
function sanitizePostgrestValue(value: string): string {
  return value.replace(/[%_\\(),."']/g, (ch) => `\\${ch}`);
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);

  const query = req.nextUrl.searchParams.get('q')?.trim();
  if (!query || query.length < 2) {
    return Response.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  try {
    const db = getServerClient();
    const sanitized = sanitizePostgrestValue(query);
    const { data, error } = await db
      .from('users')
      .select('id, name, phone')
      .or(`name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`)
      .neq('id', user.id)
      .limit(10);

    if (error) throw new Error(`searchUsers: ${error.message}`);

    return Response.json({ users: data ?? [] });
  } catch (err) {
    console.error('[GET /api/users/search]', err);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
