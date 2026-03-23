import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, GROUP_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  GROUP_ID: '33333333-3333-3333-3333-333333333333',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockGetGroupById = vi.hoisted(() => vi.fn());
const mockArchiveGroup = vi.hoisted(() => vi.fn());
const mockUpdateGroup = vi.hoisted(() => vi.fn());
const mockCreateActivity = vi.hoisted(() => vi.fn());
const mockDbSingle = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  getGroupById: mockGetGroupById,
  archiveGroup: mockArchiveGroup,
  updateGroup: mockUpdateGroup,
  createActivity: mockCreateActivity,
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

import { GET, PATCH } from './route';

const routeParams = { params: { id: GROUP_ID } };
const invalidParams = { params: { id: 'not-a-uuid' } };

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/groups/${GROUP_ID}`, { method: 'GET' });
}

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000/api/groups/${GROUP_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com', user_metadata: { name: 'Test' } });
  mockGetGroupById.mockResolvedValue({ id: GROUP_ID, name: 'Trip' });
  mockArchiveGroup.mockResolvedValue(undefined);
  mockUpdateGroup.mockResolvedValue({ id: GROUP_ID, name: 'Renamed' });
  mockCreateActivity.mockResolvedValue({ id: 'activity-1' });
  // Default: user IS a member
  mockDbSingle.mockResolvedValue({ data: { id: 'member-1' }, error: null });
});

describe('GET /api/groups/[id]', () => {
  it('should return 400 for invalid UUID', async () => {
    const res = await GET(makeGetRequest(), invalidParams);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('Invalid group ID');
  });

  it('should return 403 when user is not a member', async () => {
    mockDbSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toBe('Not a member of this group');
  });

  it('should return 200 with group on success', async () => {
    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.group).toEqual({ id: GROUP_ID, name: 'Trip' });
  });

  it('should return 500 when getGroupById throws', async () => {
    mockGetGroupById.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to fetch group');
  });
});

describe('PATCH /api/groups/[id]', () => {
  it('should return 400 for invalid UUID', async () => {
    const res = await PATCH(makePatchRequest({ action: 'archive' }), invalidParams);
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid body', async () => {
    const res = await PATCH(makePatchRequest({ action: 'invalid' }), routeParams);
    expect(res.status).toBe(400);
  });

  it('should return 403 when user is not a member', async () => {
    mockDbSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await PATCH(makePatchRequest({ action: 'archive' }), routeParams);
    expect(res.status).toBe(403);
  });

  it('should archive group successfully', async () => {
    const res = await PATCH(makePatchRequest({ action: 'archive' }), routeParams);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockArchiveGroup).toHaveBeenCalledWith(GROUP_ID);
  });

  it('should rename group successfully', async () => {
    const res = await PATCH(makePatchRequest({ action: 'rename', name: 'New Name' }), routeParams);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.group).toEqual({ id: GROUP_ID, name: 'Renamed' });
    expect(mockUpdateGroup).toHaveBeenCalledWith(GROUP_ID, { name: 'New Name' });
  });

  it('should return 400 when rename action is missing name', async () => {
    const res = await PATCH(makePatchRequest({ action: 'rename' }), routeParams);
    expect(res.status).toBe(400);
  });
});
