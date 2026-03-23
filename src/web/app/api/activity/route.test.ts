import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, GROUP_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  GROUP_ID: '33333333-3333-3333-3333-333333333333',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockGetUserActivity = vi.hoisted(() => vi.fn());
const mockGetGroupActivity = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  getUserActivity: mockGetUserActivity,
  getGroupActivity: mockGetGroupActivity,
}));

import { GET } from './route';

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/activity');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockGetUserActivity.mockResolvedValue([{ id: 'act-1', type: 'expense_added' }]);
  mockGetGroupActivity.mockResolvedValue([{ id: 'act-2', type: 'group_created' }]);
});

describe('GET /api/activity', () => {
  it('should return user activity when no groupId', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.activity).toBeDefined();
    expect(mockGetUserActivity).toHaveBeenCalledWith(FAKE_USER_ID, { limit: 50, offset: 0 });
  });

  it('should return group activity when groupId is provided', async () => {
    const res = await GET(makeGetRequest({ groupId: GROUP_ID }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.activity).toBeDefined();
    expect(mockGetGroupActivity).toHaveBeenCalledWith(GROUP_ID, { limit: 50, offset: 0 });
  });

  it('should respect limit and offset params', async () => {
    const res = await GET(makeGetRequest({ limit: '10', offset: '5' }));
    expect(res.status).toBe(200);

    expect(mockGetUserActivity).toHaveBeenCalledWith(FAKE_USER_ID, { limit: 10, offset: 5 });
  });

  it('should return 400 for invalid groupId', async () => {
    const res = await GET(makeGetRequest({ groupId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
  });

  it('should return 500 when service throws', async () => {
    mockGetUserActivity.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to fetch activity');
  });
});
