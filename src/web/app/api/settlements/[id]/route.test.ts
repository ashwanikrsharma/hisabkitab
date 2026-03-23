import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, SETTLEMENT_ID, FRIEND_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  SETTLEMENT_ID: '55555555-5555-5555-5555-555555555555',
  FRIEND_ID: '22222222-2222-2222-2222-222222222222',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockUpdateSettlementStatus = vi.hoisted(() => vi.fn());
const mockDbSettlementSingle = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  updateSettlementStatus: mockUpdateSettlementStatus,
  getServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockDbSettlementSingle,
        }),
      }),
    }),
  }),
}));

import { PATCH } from './route';

const routeParams = { params: { id: SETTLEMENT_ID } };
const invalidParams = { params: { id: 'not-a-uuid' } };

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000/api/settlements/${SETTLEMENT_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockDbSettlementSingle.mockResolvedValue({
    data: { payer_id: FAKE_USER_ID, payee_id: FRIEND_ID },
    error: null,
  });
  mockUpdateSettlementStatus.mockResolvedValue({ id: SETTLEMENT_ID, status: 'confirmed' });
});

describe('PATCH /api/settlements/[id]', () => {
  it('should return 400 for invalid settlement ID', async () => {
    const res = await PATCH(makePatchRequest({ status: 'confirmed' }), invalidParams);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('Invalid settlement ID');
  });

  it('should return 400 for invalid status', async () => {
    const res = await PATCH(makePatchRequest({ status: 'invalid' }), routeParams);
    expect(res.status).toBe(400);
  });

  it('should return 404 when settlement is not found', async () => {
    mockDbSettlementSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const res = await PATCH(makePatchRequest({ status: 'confirmed' }), routeParams);
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toBe('Settlement not found');
  });

  it('should return 403 when user is not a party to the settlement', async () => {
    const OTHER_ID = '99999999-9999-9999-9999-999999999999';
    mockDbSettlementSingle.mockResolvedValueOnce({
      data: { payer_id: OTHER_ID, payee_id: FRIEND_ID },
      error: null,
    });

    const res = await PATCH(makePatchRequest({ status: 'confirmed' }), routeParams);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toBe('You can only update settlements you are party to');
  });

  it('should return 200 and update status when user is payer', async () => {
    const res = await PATCH(makePatchRequest({ status: 'confirmed' }), routeParams);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.settlement).toEqual({ id: SETTLEMENT_ID, status: 'confirmed' });
    expect(mockUpdateSettlementStatus).toHaveBeenCalledWith(SETTLEMENT_ID, 'confirmed');
  });

  it('should return 200 when user is payee', async () => {
    mockDbSettlementSingle.mockResolvedValueOnce({
      data: { payer_id: FRIEND_ID, payee_id: FAKE_USER_ID },
      error: null,
    });

    const res = await PATCH(makePatchRequest({ status: 'disputed' }), routeParams);
    expect(res.status).toBe(200);
    expect(mockUpdateSettlementStatus).toHaveBeenCalledWith(SETTLEMENT_ID, 'disputed');
  });
});
