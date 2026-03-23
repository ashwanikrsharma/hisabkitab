import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { deleteExpense, getServerClient } from '@hisabkitab/services';

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireAuth(req);

  const paramsParsed = ParamsSchema.safeParse(params);
  if (!paramsParsed.success) {
    return Response.json({ error: 'Invalid expense ID' }, { status: 400 });
  }

  try {
    // Verify the user created this expense before allowing deletion
    const db = getServerClient();
    const { data: expense, error: fetchError } = await db
      .from('expenses')
      .select('created_by')
      .eq('id', paramsParsed.data.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !expense) {
      return Response.json({ error: 'Expense not found' }, { status: 404 });
    }

    if ((expense as { created_by: string }).created_by !== user.id) {
      return Response.json({ error: 'You can only delete expenses you created' }, { status: 403 });
    }

    await deleteExpense(paramsParsed.data.id);
    return Response.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/expenses/[id]]', err);
    return Response.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
