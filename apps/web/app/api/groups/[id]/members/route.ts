import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { addGroupMember, getUserProfile, createActivity, getServerClient } from '@hisabkitab/db';
import type { GroupMember } from '@hisabkitab/db';

type MemberWithUser = GroupMember & {
  users: { id: string; name: string; avatar_url: string | null; phone: string } | null;
};

const ParamsSchema = z.object({ id: z.string().uuid() });

const AddMemberSchema = z.object({
  userId: z.string().uuid(),
});

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

    const db = getServerClient();
    const { data, error } = await db
      .from('group_members')
      .select('*, users(id, name, avatar_url, phone)')
      .eq('group_id', paramsParsed.data.id)
      .eq('is_active', true);

    if (error) throw new Error(`getGroupMembers: ${error.message}`);

    const members = (data ?? []) as unknown as MemberWithUser[];
    return Response.json({ members });
  } catch (err) {
    console.error('[GET /api/groups/[id]/members]', err);
    return Response.json({ error: 'Failed to fetch group members' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireAuth(req);

  const paramsParsed = ParamsSchema.safeParse(params);
  if (!paramsParsed.success) {
    return Response.json({ error: 'Invalid group ID' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = AddMemberSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const groupId = paramsParsed.data.id;

  try {
    // Verify the requesting user is a member of the group
    const isMember = await verifyGroupMembership(groupId, user.id);
    if (!isMember) {
      return Response.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Check if target user is already a member
    const alreadyMember = await verifyGroupMembership(groupId, parsed.data.userId);
    if (alreadyMember) {
      return Response.json({ error: 'User is already a member of this group' }, { status: 409 });
    }

    const membership = await addGroupMember({
      groupId,
      userId: parsed.data.userId,
    });

    // Log activity (non-blocking)
    logMemberAddedActivity(groupId, user.id, parsed.data.userId)
      .catch((err) => console.error('[activity member_joined]', err));

    return Response.json({ membership }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/groups/[id]/members]', err);
    return Response.json({ error: 'Failed to add member' }, { status: 500 });
  }
}

async function logMemberAddedActivity(
  groupId: string,
  actorId: string,
  newMemberId: string,
) {
  const newMember = await getUserProfile(newMemberId);
  const memberName = newMember?.name || 'someone';

  await createActivity({
    groupId,
    actorId,
    type: 'member_joined',
    title: 'Member added',
    description: `Added ${memberName} to the group`,
    metadata: { new_member_id: newMemberId },
  });
}
