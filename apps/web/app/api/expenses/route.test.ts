import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.mock factories are hoisted — cannot reference top-level variables.
// Use inline literals or vi.hoisted to define shared values.
const { FAKE_USER_ID, FRIEND_ID, GROUP_ID, EXPENSE_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  FRIEND_ID: '22222222-2222-2222-2222-222222222222',
  GROUP_ID: '33333333-3333-3333-3333-333333333333',
  EXPENSE_ID: '44444444-4444-4444-4444-444444444444',
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' }),
}));

vi.mock('@hisabkitab/db', () => ({
  createExpense: vi.fn().mockResolvedValue({ id: EXPENSE_ID, description: 'Coffee', amount: 200 }),
  createActivity: vi.fn().mockResolvedValue({ id: 'activity-1' }),
  getGroupExpenses: vi.fn().mockResolvedValue([]),
  getDirectExpenses: vi.fn().mockResolvedValue([]),
}));

import { POST } from './route';
import { createExpense } from '@hisabkitab/db';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default mock implementation after clearAllMocks
  vi.mocked(createExpense).mockResolvedValue({ id: EXPENSE_ID, description: 'Coffee', amount: 200 } as never);
});

describe('POST /api/expenses', () => {
  it('resolves "self" in paidById to the authenticated user ID', async () => {
    const req = makeRequest({
      description: 'Coffee',
      amount: 200,
      paidById: 'self',
      splitType: 'equal',
      splitAmongUserIds: [FAKE_USER_ID, FRIEND_ID],
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        paidById: FAKE_USER_ID,
        createdBy: FAKE_USER_ID,
      }),
    );
  });

  it('resolves "self" in splitAmongUserIds to the authenticated user ID', async () => {
    const req = makeRequest({
      description: 'Lunch',
      amount: 300,
      paidById: FAKE_USER_ID,
      splitType: 'equal',
      splitAmongUserIds: ['self', FRIEND_ID],
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        splitAmongUserIds: [FAKE_USER_ID, FRIEND_ID],
      }),
    );
  });

  it('resolves "self" in splits[].userId to the authenticated user ID', async () => {
    const req = makeRequest({
      description: 'Dinner',
      amount: 500,
      paidById: 'self',
      splitType: 'exact',
      splits: [
        { userId: 'self', amount: 250 },
        { userId: FRIEND_ID, amount: 250 },
      ],
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        paidById: FAKE_USER_ID,
        splits: [
          { userId: FAKE_USER_ID, amount: 250 },
          { userId: FRIEND_ID, amount: 250 },
        ],
      }),
    );
  });

  it('resolves all "self" placeholders simultaneously (paidById + splitAmongUserIds)', async () => {
    const req = makeRequest({
      description: 'Cab ride',
      amount: 150,
      paidById: 'self',
      splitType: 'equal',
      splitAmongUserIds: ['self', FRIEND_ID],
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        paidById: FAKE_USER_ID,
        splitAmongUserIds: [FAKE_USER_ID, FRIEND_ID],
      }),
    );
  });

  it('passes through real UUIDs unchanged (group expense)', async () => {
    const req = makeRequest({
      groupId: GROUP_ID,
      description: 'Group dinner',
      amount: 1000,
      paidById: FAKE_USER_ID,
      splitType: 'equal',
      splitAmongUserIds: [FAKE_USER_ID, FRIEND_ID],
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: GROUP_ID,
        paidById: FAKE_USER_ID,
        splitAmongUserIds: [FAKE_USER_ID, FRIEND_ID],
      }),
    );
  });

  it('returns 400 for invalid body', async () => {
    const req = makeRequest({
      amount: -5,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 when createExpense throws', async () => {
    vi.mocked(createExpense).mockRejectedValueOnce(new Error('DB down'));

    const req = makeRequest({
      description: 'Test',
      amount: 100,
      paidById: FAKE_USER_ID,
      splitType: 'equal',
      splitAmongUserIds: [FAKE_USER_ID],
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to create expense');
  });
});
