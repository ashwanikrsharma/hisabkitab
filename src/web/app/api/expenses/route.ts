import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getGroupExpenses, getDirectExpenses, createExpense, createActivity } from '@hisabkitab/services';

const CreateExpenseSchema = z.object({
  groupId: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  currency: z.string().length(3).default('INR'),
  paidById: z.string().uuid(),
  category: z.string().optional(),
  splitType: z.enum(['equal', 'exact', 'percentage']).default('equal'),
  notes: z.string().max(1000).optional(),
  splits: z
    .array(
      z.object({
        userId: z.string().uuid(),
        amount: z.number().nonnegative(),
        percentage: z.number().nonnegative().optional(),
      }),
    )
    .optional(),
  splitAmongUserIds: z.array(z.string().uuid()).optional(),
});

const GetExpensesSchema = z.object({
  groupId: z.string().uuid().optional(),
  direct: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = GetExpensesSchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.direct === 'true') {
      const expenses = await getDirectExpenses(user.id, {
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });
      return Response.json({ expenses });
    }

    if (!parsed.data.groupId) {
      return Response.json({ error: 'groupId is required when direct is not true' }, { status: 400 });
    }

    const expenses = await getGroupExpenses(parsed.data.groupId, {
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return Response.json({ expenses });
  } catch (err) {
    console.error('[GET /api/expenses]', err);
    return Response.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);

  const body = await req.json().catch(() => null);

  // Resolve 'self' placeholder to the authenticated user's ID
  // The direct expense form uses 'self' since it doesn't know the user UUID client-side
  if (body && typeof body === 'object') {
    if (body.paidById === 'self') {
      body.paidById = user.id;
    }
    if (Array.isArray(body.splitAmongUserIds)) {
      body.splitAmongUserIds = body.splitAmongUserIds.map((id: string) =>
        id === 'self' ? user.id : id,
      );
    }
    if (Array.isArray(body.splits)) {
      body.splits = body.splits.map((s: Record<string, unknown>) =>
        s.userId === 'self' ? { ...s, userId: user.id } : s,
      );
    }
  }

  const parsed = CreateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const expense = await createExpense({
      groupId: parsed.data.groupId,
      description: parsed.data.description,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      paidById: parsed.data.paidById,
      category: parsed.data.category,
      splitType: parsed.data.splitType,
      notes: parsed.data.notes,
      splits: parsed.data.splits,
      splitAmongUserIds: parsed.data.splitAmongUserIds,
      createdBy: user.id,
    });

    const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: parsed.data.currency }).format(parsed.data.amount);

    // Log activity (non-blocking)
    createActivity({
      groupId: parsed.data.groupId,
      actorId: user.id,
      type: 'expense_added',
      title: 'Expense added',
      description: `${parsed.data.description} — ${fmt}`,
      metadata: { expense_id: expense.id, amount: parsed.data.amount, currency: parsed.data.currency, category: parsed.data.category },
    }).catch((err) => console.error('[activity expense_added]', err));

    return Response.json({ expense }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/expenses]', err);
    return Response.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
