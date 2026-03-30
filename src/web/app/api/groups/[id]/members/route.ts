import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { sendPushNotifications } from '@/lib/push-sender';
import {
  addGroupMember,
  getUserProfile,
  createActivity,
  isGroupMember,
  getGroupMembers,
  getGroupMemberUserIds,
} from '@hisabkitab/services';

const ParamsSchema = z.object({ id: z.string().uuid() });

const AddMemberSchema = z.object({
  userId: z.string().uuid(),
});

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
    const isMember = await isGroupMember(paramsParsed.data.id, user.id);
    if (!isMember) {
      return Response.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    const members = await getGroupMembers(paramsParsed.data.id);
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
    const isMember = await isGroupMember(groupId, user.id);
    if (!isMember) {
      return Response.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Check if target user is already a member
    const alreadyMember = await isGroupMember(groupId, parsed.data.userId);
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

    // Non-blocking push notification to existing group members
    notifyMembersOfNewJoin(groupId, user.id, parsed.data.userId)
      .catch((err) => console.error('[push member_joined]', err));

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

async function notifyMembersOfNewJoin(
  groupId: string,
  actorId: string,
  newMemberId: string,
) {
  // Use service function instead of raw Supabase query
  const memberUserIds = await getGroupMemberUserIds(groupId);

  const existingMemberIds = memberUserIds
    .filter((id) => id !== actorId && id !== newMemberId);

  if (existingMemberIds.length === 0) return;

  const newMember = await getUserProfile(newMemberId);
  const newMemberName = newMember?.name || 'Someone';

  await sendPushNotifications({
    userIds: existingMemberIds,
    title: 'New Member',
    body: `${newMemberName} joined the group`,
    data: { type: 'member_joined', groupId },
  });
}
