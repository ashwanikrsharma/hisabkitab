import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getGroupBalances, getServerClient } from '@hisabkitab/services';

const ParamsSchema = z.object({ id: z.string().uuid() });

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

    const summary = await getGroupBalances(paramsParsed.data.id);

    // Map simplified debts to the shape the mobile client expects:
    // { debts: Array<{ fromUserId, fromName, toUserId, toName, amount, currency }> }
    const debts = summary.simplifiedDebts.map((d) => ({
      fromUserId: d.fromUserId,
      fromName: d.fromName,
      toUserId: d.toUserId,
      toName: d.toName,
      amount: d.amount,
      currency: summary.currency,
    }));

    return Response.json({ debts });
  } catch (err) {
    console.error('[GET /api/groups/[id]/balances]', err);
    return Response.json({ error: 'Failed to fetch group balances' }, { status: 500 });
  }
}
