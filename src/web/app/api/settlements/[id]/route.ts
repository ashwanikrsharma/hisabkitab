import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { updateSettlementStatus, getServerClient } from '@hisabkitab/services';

const ParamsSchema = z.object({ id: z.string().uuid() });

const PatchSettlementSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'disputed']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireAuth(req);

  const paramsParsed = ParamsSchema.safeParse(params);
  if (!paramsParsed.success) {
    return Response.json({ error: 'Invalid settlement ID' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSettlementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Verify the user is a party to this settlement
    const db = getServerClient();
    const { data: settlement, error: fetchError } = await db
      .from('settlements')
      .select('payer_id, payee_id')
      .eq('id', paramsParsed.data.id)
      .single();

    if (fetchError || !settlement) {
      return Response.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const s = settlement as { payer_id: string; payee_id: string };
    if (s.payer_id !== user.id && s.payee_id !== user.id) {
      return Response.json({ error: 'You can only update settlements you are party to' }, { status: 403 });
    }

    const updated = await updateSettlementStatus(paramsParsed.data.id, parsed.data.status);
    return Response.json({ settlement: updated });
  } catch (err) {
    console.error('[PATCH /api/settlements/[id]]', err);
    return Response.json({ error: 'Failed to update settlement' }, { status: 500 });
  }
}
