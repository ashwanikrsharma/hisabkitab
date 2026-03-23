import { getServerClient } from '../client';
import type { Activity, ActivityType } from '../types';

export type CreateActivityInput = {
  groupId?: string;
  actorId: string;
  type: ActivityType;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
};

/**
 * Returns recent activity for a single group, most recent first.
 */
export async function getGroupActivity(
  groupId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Activity[]> {
  const db = getServerClient();
  const { limit = 50, offset = 0 } = opts;

  const { data, error } = await db
    .from('activity_log')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getGroupActivity: ${error.message}`);
  return (data ?? []) as Activity[];
}

/**
 * Returns recent activity across all groups a user belongs to.
 */
export async function getUserActivity(
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Activity[]> {
  const db = getServerClient();
  const { limit = 50, offset = 0 } = opts;

  // First get the user's group IDs
  const { data: memberships, error: memberError } = await db
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (memberError) throw new Error(`getUserActivity memberships: ${memberError.message}`);

  const groupIds = (memberships ?? []).map((m) => m.group_id);

  // Fetch enough from each source to cover offset + limit after merge
  const fetchLimit = offset + limit;

  const [groupResult, directResult] = await Promise.all([
    groupIds.length > 0
      ? db
          .from('activity_log')
          .select('*')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false })
          .range(0, fetchLimit - 1)
      : Promise.resolve({ data: [] as Activity[], error: null }),
    db
      .from('activity_log')
      .select('*')
      .is('group_id', null)
      .eq('actor_id', userId)
      .order('created_at', { ascending: false })
      .range(0, fetchLimit - 1),
  ]);

  if (groupResult.error) throw new Error(`getUserActivity (group): ${groupResult.error.message}`);
  if (directResult.error) throw new Error(`getUserActivity (direct): ${directResult.error.message}`);

  // Merge, sort, then apply offset + limit
  const merged = [...((groupResult.data ?? []) as Activity[]), ...((directResult.data ?? []) as Activity[])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(offset, offset + limit);

  return merged;
}

/**
 * Creates a single activity log entry.
 */
export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  const db = getServerClient();

  const { data, error } = await db
    .from('activity_log')
    .insert({
      group_id: input.groupId ?? null,
      actor_id: input.actorId,
      type: input.type,
      title: input.title,
      description: input.description,
      metadata: input.metadata ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createActivity: ${error.message}`);
  if (!data) throw new Error('createActivity: no data returned');
  return data as Activity;
}
