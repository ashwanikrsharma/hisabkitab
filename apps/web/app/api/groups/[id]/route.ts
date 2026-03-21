import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getGroupById, archiveGroup, updateGroup, createActivity, getServerClient } from '@hisabkitab/db';

const ParamsSchema = z.object({ id: z.string().uuid() });

const PatchGroupSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('archive') }),
  z.object({ action: z.literal('rename'), name: z.string().min(1).max(100) }),
]);

async function verifyGroupMembership(groupId: string, userId: string): Promise<boolean> {
  const db = getServerClient();
  const { data } = await db
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();
  return !!data;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireAuth(req);

  const paramsParsed = ParamsSchema.safeParse(params);
  if (!paramsParsed.success) {
    return Response.json({ error: 'Invalid group ID' }, { status: 400 });
  }

  try {
    const isMember = await verifyGroupMembership(paramsParsed.data.id, user.id);
    if (!isMember) {
      return Response.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    const group = await getGroupById(paramsParsed.data.id);
    return Response.json({ group });
  } catch (err) {
    console.error('[GET /api/groups/[id]]', err);
    return Response.json({ error: 'Failed to fetch group' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireAuth(req);

  const paramsParsed = ParamsSchema.safeParse(params);
  if (!paramsParsed.success) {
    return Response.json({ error: 'Invalid group ID' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchGroupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const isMember = await verifyGroupMembership(paramsParsed.data.id, user.id);
    if (!isMember) {
      return Response.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    if (parsed.data.action === 'archive') {
      await archiveGroup(paramsParsed.data.id);
      createActivity({
        groupId: paramsParsed.data.id,
        actorId: user.id,
        type: 'group_archived',
        title: 'Group archived',
        description: `${user.user_metadata?.name ?? 'Someone'} archived the group`,
      }).catch((err) => console.error('[PATCH /api/groups/[id]] activity logging failed (archive):', err));
      return Response.json({ success: true });
    }

    if (parsed.data.action === 'rename') {
      const updated = await updateGroup(paramsParsed.data.id, { name: parsed.data.name });
      createActivity({
        groupId: paramsParsed.data.id,
        actorId: user.id,
        type: 'group_renamed',
        title: 'Group renamed',
        description: `${user.user_metadata?.name ?? 'Someone'} renamed the group to "${parsed.data.name}"`,
      }).catch((err) => console.error('[PATCH /api/groups/[id]] activity logging failed (rename):', err));
      return Response.json({ group: updated });
    }
  } catch (err) {
    console.error('[PATCH /api/groups/[id]]', err);
    return Response.json({ error: 'Failed to update group' }, { status: 500 });
  }
}
