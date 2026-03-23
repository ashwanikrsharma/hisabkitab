import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, EXPENSE_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  EXPENSE_ID: '44444444-4444-4444-4444-444444444444',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockDeleteExpense = vi.hoisted(() => vi.fn());
const mockDbSingle = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  deleteExpense: mockDeleteExpense,
  getServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            single: mockDbSingle,
          }),
        }),
      }),
    }),
  }),
}));

import { DELETE } from './route';

const routeParams = { params: { id: EXPENSE_ID } };
const invalidParams = { params: { id: 'not-a-uuid' } };

function makeDeleteRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/expenses/${EXPENSE_ID}`, { method: 'DELETE' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockDbSingle.mockResolvedValue({
    data: { created_by: FAKE_USER_ID },
    error: null,
  });
  mockDeleteExpense.mockResolvedValue(undefined);
});

describe('DELETE /api/expenses/[id]', () => {
  it('should return 400 for invalid expense ID', async () => {
    const res = await DELETE(makeDeleteRequest(), invalidParams);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('Invalid expense ID');
  });

  it('should return 404 when expense is not found', async () => {
    mockDbSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toBe('Expense not found');
  });

  it('should return 403 when user is not the creator', async () => {
    const OTHER_ID = '99999999-9999-9999-9999-999999999999';
    mockDbSingle.mockResolvedValueOnce({
      data: { created_by: OTHER_ID },
      error: null,
    });

    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toBe('You can only delete expenses you created');
  });

  it('should return 200 on successful deletion', async () => {
    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockDeleteExpense).toHaveBeenCalledWith(EXPENSE_ID);
  });

  it('should return 500 when deleteExpense throws', async () => {
    mockDeleteExpense.mockRejectedValueOnce(new Error('DB down'));

    const res = await DELETE(makeDeleteRequest(), routeParams);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to delete expense');
  });
});
