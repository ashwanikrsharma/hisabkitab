import { getServerClient } from '../client';
import type { Group, GroupMember } from '../types';

export type GroupWithMembers = Group & { members: GroupMember[] };

/**
 * Returns all active groups for a given user (via group_members join).
 * RLS on group_members ensures users only see their own groups.
 */
export async function getUserGroups(userId: string): Promise<Group[]> {
  const db = getServerClient();

  const { data, error } = await db
    .from('group_members')
    .select('groups(*)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('groups', 'is', null);

  if (error) throw new Error(`getUserGroups: ${error.message}`);

  // Unwrap the nested join result
  return (data ?? [])
    .map((row) => (row as unknown as { groups: Group }).groups)
    .filter(Boolean);
}

/**
 * Returns a single group by ID, including its members.
 * Throws if the group doesn't exist or the user doesn't have access (RLS).
 */
export async function getGroupById(groupId: string): Promise<GroupWithMembers> {
  const db = getServerClient();

  const { data, error } = await db
    .from('groups')
    .select('*, members:group_members(*)')
    .eq('id', groupId)
    .eq('is_archived', false)
    .single();

  if (error) throw new Error(`getGroupById: ${error.message}`);
  if (!data) throw new Error(`Group ${groupId} not found`);

  return data as unknown as GroupWithMembers;
}

/**
 * Creates a new group and adds the creator as admin.
 */
export async function createGroup(input: {
  name: string;
  currency: string;
  description?: string;
  createdBy: string;
}): Promise<Group> {
  const db = getServerClient();

  const { data: group, error: groupError } = await db
    .from('groups')
    .insert({
      name: input.name,
      currency: input.currency,
      description: input.description ?? null,
      created_by: input.createdBy,
      is_archived: false,
    })
    .select()
    .single();

  if (groupError) throw new Error(`createGroup (insert): ${groupError.message}`);
  if (!group) throw new Error('createGroup: no data returned');

  const groupData = group as unknown as Group;

  // Add creator as admin member
  const { error: memberError } = await db.from('group_members').insert({
    group_id: groupData.id,
    user_id: input.createdBy,
    role: 'admin',
    is_active: true,
  });

  if (memberError) throw new Error(`createGroup (member): ${memberError.message}`);

  return groupData;
}

/**
 * Archives a group (soft delete). Only callable by group admin.
 */
export async function archiveGroup(groupId: string): Promise<void> {
  const db = getServerClient();

  const { error } = await db
    .from('groups')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', groupId);

  if (error) throw new Error(`archiveGroup: ${error.message}`);
}

/**
 * Adds a user to a group as a member.
 * Returns the created GroupMember row.
 * Throws if the insert fails (e.g., duplicate membership).
 */
export async function addGroupMember(input: {
  groupId: string;
  userId: string;
  role?: 'admin' | 'member';
}): Promise<GroupMember> {
  const db = getServerClient();

  const { data, error } = await db
    .from('group_members')
    .insert({
      group_id: input.groupId,
      user_id: input.userId,
      role: input.role ?? 'member',
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`addGroupMember: ${error.message}`);
  if (!data) throw new Error('addGroupMember: no data returned');

  return data as unknown as GroupMember;
}

/**
 * Checks whether a user is an active member of a group.
 */
export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
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

export type GroupMemberWithUser = GroupMember & {
  users: { id: string; name: string; avatar_url: string | null; phone: string } | null;
};

/**
 * Returns all active members of a group, including joined user profile data.
 */
export async function getGroupMembers(groupId: string): Promise<GroupMemberWithUser[]> {
  const db = getServerClient();

  const { data, error } = await db
    .from('group_members')
    .select('*, users(id, name, avatar_url, phone)')
    .eq('group_id', groupId)
    .eq('is_active', true);

  if (error) throw new Error(`getGroupMembers: ${error.message}`);

  return (data ?? []) as unknown as GroupMemberWithUser[];
}

/**
 * Returns active member user IDs for a group.
 */
export async function getGroupMemberUserIds(groupId: string): Promise<string[]> {
  const db = getServerClient();

  const { data, error } = await db
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('is_active', true);

  if (error) throw new Error(`getGroupMemberUserIds: ${error.message}`);

  return (data ?? []).map((m) => m.user_id);
}

/**
 * Updates a group's name and/or description.
 */
export async function updateGroup(
  groupId: string,
  input: { name?: string; description?: string | null },
): Promise<Group> {
  const db = getServerClient();

  const { data, error } = await db
    .from('groups')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', groupId)
    .select()
    .single();

  if (error) throw new Error(`updateGroup: ${error.message}`);
  if (!data) throw new Error(`updateGroup: group ${groupId} not found`);

  return data as unknown as Group;
}
