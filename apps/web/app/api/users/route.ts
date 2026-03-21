import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getUserProfile, upsertUser, updateUserProfile } from '@hisabkitab/db';

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
  default_currency: z.string().length(3).optional(),
  upi_id: z.string().max(100).optional(),
});

export async function GET(_req: NextRequest) {
  const user = await requireAuth(_req);

  try {
    let profile = await getUserProfile(user.id);

    if (!profile) {
      // First sign-in: seed a minimal users row from auth data
      profile = await upsertUser(user.id, {
        phone: user.phone ?? '',
        name: user.user_metadata?.name ?? '',
      });
    }

    return Response.json({ user: profile });
  } catch (err) {
    console.error('[GET /api/users]', err);
    return Response.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);

  const body = await req.json().catch(() => null);
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateUserProfile(user.id, {
      name: parsed.data.name,
      avatar_url: parsed.data.avatar_url,
      upi_id: parsed.data.upi_id,
      default_currency: parsed.data.default_currency,
    });
    return Response.json({ user: updated });
  } catch (err) {
    console.error('[PATCH /api/users]', err);
    return Response.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}
