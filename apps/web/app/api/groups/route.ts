import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getUserGroups, createGroup, createActivity } from '@hisabkitab/db';

const CreateGroupSchema = z.object({
  name: z.string().min(1).max(100),
  currency: z.string().length(3).default('INR'),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string().uuid()).optional().default([]),
});

export async function GET(_req: NextRequest) {
  const user = await requireAuth(_req);

  try {
    const groups = await getUserGroups(user.id);
    return Response.json({ groups });
  } catch (err) {
    console.error('[GET /api/groups]', err);
    return Response.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);

  const body = await req.json().catch(() => null);
  const parsed = CreateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const group = await createGroup({
      name: parsed.data.name,
      currency: parsed.data.currency,
      description: parsed.data.description,
      createdBy: user.id,
    });

    // Add initial members (if provided)
    if (parsed.data.memberIds && parsed.data.memberIds.length > 0) {
      const { getServerClient } = await import('@hisabkitab/db');
      const db = getServerClient();
      const memberRows = parsed.data.memberIds
        .filter((id) => id !== user.id) // creator is already added as admin
        .map((userId) => ({
          group_id: group.id,
          user_id: userId,
          role: 'member' as const,
          is_active: true,
        }));
      if (memberRows.length > 0) {
        const { error: memberError } = await db.from('group_members').insert(memberRows);
        if (memberError) {
          console.error('[POST /api/groups] failed to add initial members:', memberError);
        }
      }
    }

    // Log activity (non-blocking)
    createActivity({
      groupId: group.id,
      actorId: user.id,
      type: 'group_created',
      title: 'Group created',
      description: `${user.user_metadata?.name ?? 'Someone'} created "${parsed.data.name}"`,
    }).catch((err) => console.error('[POST /api/groups] activity logging failed:', err));
    return Response.json({ group }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/groups]', err);
    return Response.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
