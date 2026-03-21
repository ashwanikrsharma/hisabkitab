import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getUserActivity, getGroupActivity } from '@hisabkitab/db';

const GetActivitySchema = z.object({
  groupId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = GetActivitySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const activity = parsed.data.groupId
      ? await getGroupActivity(parsed.data.groupId, {
          limit: parsed.data.limit,
          offset: parsed.data.offset,
        })
      : await getUserActivity(user.id, {
          limit: parsed.data.limit,
          offset: parsed.data.offset,
        });

    return Response.json({ activity });
  } catch (err) {
    console.error('[GET /api/activity]', err);
    return Response.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
