import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import {
  getDirectExpensesBetweenUsers,
  getDirectSettlementsBetweenUsers,
  getUserProfile,
} from '@hisabkitab/db';

const ParamsSchema = z.object({
  userId: z.string().uuid(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const user = await requireAuth(req);

  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const friendId = parsed.data.userId;

  try {
    const [expenses, settlements, friend] = await Promise.all([
      getDirectExpensesBetweenUsers(user.id, friendId),
      getDirectSettlementsBetweenUsers(user.id, friendId),
      getUserProfile(friendId),
    ]);

    if (!friend) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({ friend, expenses, settlements });
  } catch (err) {
    console.error('[GET /api/friends/:userId]', err);
    return Response.json({ error: 'Failed to fetch friend data' }, { status: 500 });
  }
}
