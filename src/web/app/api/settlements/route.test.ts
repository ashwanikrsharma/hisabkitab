import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, GROUP_ID, FRIEND_ID, SETTLEMENT_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  GROUP_ID: '33333333-3333-3333-3333-333333333333',
  FRIEND_ID: '22222222-2222-2222-2222-222222222222',
  SETTLEMENT_ID: '55555555-5555-5555-5555-555555555555',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockGetGroupSettlements = vi.hoisted(() => vi.fn());
const mockGetDirectSettlements = vi.hoisted(() => vi.fn());
const mockCreateSettlement = vi.hoisted(() => vi.fn());
const mockGetUserProfile = vi.hoisted(() => vi.fn());
const mockCreateActivity = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  getGroupSettlements: mockGetGroupSettlements,
  getDirectSettlements: mockGetDirectSettlements,
  createSettlement: mockCreateSettlement,
  getUserProfile: mockGetUserProfile,
  createActivity: mockCreateActivity,
}));

import { GET, POST } from './route';

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/settlements');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/settlements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockGetGroupSettlements.mockResolvedValue([{ id: SETTLEMENT_ID }]);
  mockGetDirectSettlements.mockResolvedValue([{ id: SETTLEMENT_ID }]);
  mockCreateSettlement.mockResolvedValue({ id: SETTLEMENT_ID, amount: 500 });
  mockGetUserProfile.mockResolvedValue({ id: FRIEND_ID, name: 'Friend' });
  mockCreateActivity.mockResolvedValue({ id: 'activity-1' });
});

describe('GET /api/settlements', () => {
  it('should return direct settlements when direct=true', async () => {
    const res = await GET(makeGetRequest({ direct: 'true' }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.settlements).toBeDefined();
    expect(mockGetDirectSettlements).toHaveBeenCalledWith(FAKE_USER_ID);
  });

  it('should return 400 when groupId is missing and direct is not true', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('groupId is required when direct is not true');
  });

  it('should return group settlements when groupId is provided', async () => {
    const res = await GET(makeGetRequest({ groupId: GROUP_ID }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.settlements).toBeDefined();
    expect(mockGetGroupSettlements).toHaveBeenCalledWith(GROUP_ID);
  });

  it('should return 500 when service throws', async () => {
    mockGetDirectSettlements.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(makeGetRequest({ direct: 'true' }));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to fetch settlements');
  });
});

describe('POST /api/settlements', () => {
  it('should return 400 for invalid body', async () => {
    const res = await POST(makePostRequest({ amount: -5 }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
  });

  it('should return 201 on success', async () => {
    const res = await POST(makePostRequest({
      payerId: FAKE_USER_ID,
      payeeId: FRIEND_ID,
      amount: 500,
    }));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.settlement).toEqual({ id: SETTLEMENT_ID, amount: 500 });
    expect(mockCreateSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        payerId: FAKE_USER_ID,
        payeeId: FRIEND_ID,
        amount: 500,
        currency: 'INR',
      }),
    );
  });

  it('should resolve self placeholder in payerId', async () => {
    const res = await POST(makePostRequest({
      payerId: 'self',
      payeeId: FRIEND_ID,
      amount: 200,
    }));
    expect(res.status).toBe(201);

    // The route overrides payerId to user.id regardless, so the mock should receive FAKE_USER_ID
    expect(mockCreateSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        payerId: FAKE_USER_ID,
      }),
    );
  });

  it('should return 500 when createSettlement throws', async () => {
    mockCreateSettlement.mockRejectedValueOnce(new Error('DB down'));

    const res = await POST(makePostRequest({
      payerId: FAKE_USER_ID,
      payeeId: FRIEND_ID,
      amount: 300,
    }));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to create settlement');
  });
});
