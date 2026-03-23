import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, GROUP_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  GROUP_ID: '33333333-3333-3333-3333-333333333333',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockGetUserGroups = vi.hoisted(() => vi.fn());
const mockCreateGroup = vi.hoisted(() => vi.fn());
const mockCreateActivity = vi.hoisted(() => vi.fn());
const mockGetServerClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  getUserGroups: mockGetUserGroups,
  createGroup: mockCreateGroup,
  createActivity: mockCreateActivity,
  getServerClient: mockGetServerClient,
}));

import { GET, POST } from './route';

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/groups', { method: 'GET' });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com', user_metadata: { name: 'Test' } });
  mockGetUserGroups.mockResolvedValue([{ id: GROUP_ID, name: 'Trip' }]);
  mockCreateGroup.mockResolvedValue({ id: GROUP_ID, name: 'Trip' });
  mockCreateActivity.mockResolvedValue({ id: 'activity-1' });
});

describe('GET /api/groups', () => {
  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

    await expect(GET(makeGetRequest())).rejects.toBeDefined();
  });

  it('should return groups on success', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.groups).toEqual([{ id: GROUP_ID, name: 'Trip' }]);
    expect(mockGetUserGroups).toHaveBeenCalledWith(FAKE_USER_ID);
  });

  it('should return 500 when getUserGroups throws', async () => {
    mockGetUserGroups.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to fetch groups');
  });
});

describe('POST /api/groups', () => {
  it('should return 400 when name is missing', async () => {
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
  });

  it('should return 201 on success with default currency INR', async () => {
    const res = await POST(makePostRequest({ name: 'Trip' }));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.group).toEqual({ id: GROUP_ID, name: 'Trip' });

    expect(mockCreateGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Trip',
        currency: 'INR',
        createdBy: FAKE_USER_ID,
      }),
    );
  });

  it('should return 500 when createGroup throws', async () => {
    mockCreateGroup.mockRejectedValueOnce(new Error('DB down'));

    const res = await POST(makePostRequest({ name: 'Fail' }));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to create group');
  });
});
