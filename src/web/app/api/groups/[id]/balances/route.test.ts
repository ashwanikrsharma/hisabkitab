import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, GROUP_ID, FRIEND_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  GROUP_ID: '33333333-3333-3333-3333-333333333333',
  FRIEND_ID: '22222222-2222-2222-2222-222222222222',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockGetGroupBalances = vi.hoisted(() => vi.fn());
const mockDbSingle = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  getGroupBalances: mockGetGroupBalances,
  getServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                single: mockDbSingle,
              }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

import { GET } from './route';

const routeParams = { params: { id: GROUP_ID } };
const invalidParams = { params: { id: 'not-a-uuid' } };

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/groups/${GROUP_ID}/balances`, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockDbSingle.mockResolvedValue({ data: { id: 'member-1' }, error: null });
  mockGetGroupBalances.mockResolvedValue({
    currency: 'INR',
    simplifiedDebts: [
      { fromUserId: FAKE_USER_ID, fromName: 'Test', toUserId: FRIEND_ID, toName: 'Friend', amount: 250 },
    ],
  });
});

describe('GET /api/groups/[id]/balances', () => {
  it('should return 400 for invalid group ID', async () => {
    const res = await GET(makeGetRequest(), invalidParams);
    expect(res.status).toBe(400);
  });

  it('should return 403 when user is not a member', async () => {
    mockDbSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(403);
  });

  it('should return 200 with debts on success', async () => {
    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.debts).toHaveLength(1);
    expect(data.debts[0]).toEqual(
      expect.objectContaining({
        fromUserId: FAKE_USER_ID,
        toUserId: FRIEND_ID,
        amount: 250,
        currency: 'INR',
      }),
    );
  });

  it('should return 500 when getGroupBalances throws', async () => {
    mockGetGroupBalances.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to fetch group balances');
  });
});
