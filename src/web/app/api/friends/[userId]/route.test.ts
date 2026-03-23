import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, FRIEND_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  FRIEND_ID: '22222222-2222-2222-2222-222222222222',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockGetDirectExpensesBetweenUsers = vi.hoisted(() => vi.fn());
const mockGetDirectSettlementsBetweenUsers = vi.hoisted(() => vi.fn());
const mockGetUserProfile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  getDirectExpensesBetweenUsers: mockGetDirectExpensesBetweenUsers,
  getDirectSettlementsBetweenUsers: mockGetDirectSettlementsBetweenUsers,
  getUserProfile: mockGetUserProfile,
}));

import { GET } from './route';

const routeParams = { params: { userId: FRIEND_ID } };
const invalidParams = { params: { userId: 'not-a-uuid' } };

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/friends/${FRIEND_ID}`, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockGetDirectExpensesBetweenUsers.mockResolvedValue([{ id: 'exp-1', amount: 100 }]);
  mockGetDirectSettlementsBetweenUsers.mockResolvedValue([{ id: 'set-1', amount: 50 }]);
  mockGetUserProfile.mockResolvedValue({ id: FRIEND_ID, name: 'Friend', phone: '+919876543210' });
});

describe('GET /api/friends/[userId]', () => {
  it('should return 400 for invalid userId', async () => {
    const res = await GET(makeGetRequest(), invalidParams);
    expect(res.status).toBe(400);
  });

  it('should return 404 when friend is not found', async () => {
    mockGetUserProfile.mockResolvedValueOnce(null);

    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toBe('User not found');
  });

  it('should return 200 with friend data, expenses, and settlements', async () => {
    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.friend).toEqual({ id: FRIEND_ID, name: 'Friend', phone: '+919876543210' });
    expect(data.expenses).toHaveLength(1);
    expect(data.settlements).toHaveLength(1);
    expect(mockGetDirectExpensesBetweenUsers).toHaveBeenCalledWith(FAKE_USER_ID, FRIEND_ID);
    expect(mockGetDirectSettlementsBetweenUsers).toHaveBeenCalledWith(FAKE_USER_ID, FRIEND_ID);
  });

  it('should return 500 when service throws', async () => {
    mockGetDirectExpensesBetweenUsers.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to fetch friend data');
  });
});
