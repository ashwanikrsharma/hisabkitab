import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getGroupSettlements, getDirectSettlements, createSettlement, getUserProfile, createActivity } from '@hisabkitab/db';

const CreateSettlementSchema = z.object({
  groupId: z.string().uuid().optional(),
  payerId: z.string().uuid(),
  payeeId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('INR'),
  note: z.string().max(300).optional(),
  upiTransactionId: z.string().max(100).optional(),
  paymentMethod: z.enum(['upi', 'cash', 'bank']).optional(),
});

const GetSettlementsSchema = z.object({
  groupId: z.string().uuid().optional(),
  direct: z.enum(['true', 'false']).optional(),
});

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = GetSettlementsSchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.direct === 'true') {
      const settlements = await getDirectSettlements(user.id);
      return Response.json({ settlements });
    }

    if (!parsed.data.groupId) {
      return Response.json({ error: 'groupId is required when direct is not true' }, { status: 400 });
    }

    const settlements = await getGroupSettlements(parsed.data.groupId);
    return Response.json({ settlements });
  } catch (err) {
    console.error('[GET /api/settlements]', err);
    return Response.json({ error: 'Failed to fetch settlements' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);

  const body = await req.json().catch(() => null);

  // Resolve 'self' placeholder to the authenticated user's ID (same pattern as expenses route)
  if (body && typeof body === 'object') {
    if (body.payerId === 'self') {
      body.payerId = user.id;
    }
  }

  const parsed = CreateSettlementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Use authenticated user as payer (override whatever was sent)
  const payerId = user.id;

  try {
    const settlement = await createSettlement({
      groupId: parsed.data.groupId,
      payerId,
      payeeId: parsed.data.payeeId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      note: parsed.data.note,
      upiTransactionId: parsed.data.upiTransactionId,
      paymentMethod: parsed.data.paymentMethod,
    });

    // Log activity (non-blocking)
    logSettlementActivity(parsed.data.groupId, payerId, parsed.data.payeeId, parsed.data.amount, parsed.data.currency)
      .catch((err) => console.error('[activity settlement_created]', err));

    return Response.json({ settlement }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/settlements]', err);
    return Response.json({ error: 'Failed to create settlement' }, { status: 500 });
  }
}

async function logSettlementActivity(
  groupId: string | undefined,
  payerId: string,
  payeeId: string,
  amount: number,
  currency: string,
) {
  const payee = await getUserProfile(payeeId);
  const payeeName = payee?.name || 'someone';
  const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);

  await createActivity({
    groupId,
    actorId: payerId,
    type: 'settlement_created',
    title: 'Settlement recorded',
    description: `Paid ${payeeName} ${fmt}`,
    metadata: { payee_id: payeeId, amount, currency },
  });
}
