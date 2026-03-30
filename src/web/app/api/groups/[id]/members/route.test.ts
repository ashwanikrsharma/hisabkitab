import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, GROUP_ID, FRIEND_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  GROUP_ID: '33333333-3333-3333-3333-333333333333',
  FRIEND_ID: '22222222-2222-2222-2222-222222222222',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockAddGroupMember = vi.hoisted(() => vi.fn());
const mockGetUserProfile = vi.hoisted(() => vi.fn());
const mockCreateActivity = vi.hoisted(() => vi.fn());
const mockIsGroupMember = vi.hoisted(() => vi.fn());
const mockGetGroupMembers = vi.hoisted(() => vi.fn());
const mockGetGroupMemberUserIds = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@/lib/push-sender', () => ({
  sendPushNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@hisabkitab/services', () => ({
  addGroupMember: mockAddGroupMember,
  getUserProfile: mockGetUserProfile,
  createActivity: mockCreateActivity,
  isGroupMember: mockIsGroupMember,
  getGroupMembers: mockGetGroupMembers,
  getGroupMemberUserIds: mockGetGroupMemberUserIds,
}));

import { GET, POST } from './route';

const routeParams = { params: { id: GROUP_ID } };
const invalidParams = { params: { id: 'not-a-uuid' } };

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/groups/${GROUP_ID}/members`, { method: 'GET' });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000/api/groups/${GROUP_ID}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockAddGroupMember.mockResolvedValue({ id: 'membership-1', group_id: GROUP_ID, user_id: FRIEND_ID });
  mockGetUserProfile.mockResolvedValue({ id: FRIEND_ID, name: 'Friend' });
  mockCreateActivity.mockResolvedValue({ id: 'activity-1' });
  // Default: user IS a member
  mockIsGroupMember.mockResolvedValue(true);
  mockGetGroupMembers.mockResolvedValue([
    { id: 'member-1', user_id: FAKE_USER_ID, name: 'Test', avatar_url: null, phone: '1234567890' },
  ]);
  mockGetGroupMemberUserIds.mockResolvedValue([FAKE_USER_ID]);
});

describe('GET /api/groups/[id]/members', () => {
  it('should return 400 for invalid group ID', async () => {
    const res = await GET(makeGetRequest(), invalidParams);
    expect(res.status).toBe(400);
  });

  it('should return 403 when user is not a member', async () => {
    mockIsGroupMember.mockResolvedValueOnce(false);

    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(403);
  });

  it('should return 200 with members on success', async () => {
    const res = await GET(makeGetRequest(), routeParams);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.members).toBeDefined();
    expect(Array.isArray(data.members)).toBe(true);
  });
});

describe('POST /api/groups/[id]/members', () => {
  it('should return 400 when userId is missing', async () => {
    const res = await POST(makePostRequest({}), routeParams);
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid group ID', async () => {
    const res = await POST(makePostRequest({ userId: FRIEND_ID }), invalidParams);
    expect(res.status).toBe(400);
  });

  it('should return 403 when requester is not a member', async () => {
    mockIsGroupMember.mockResolvedValueOnce(false);

    const res = await POST(makePostRequest({ userId: FRIEND_ID }), routeParams);
    expect(res.status).toBe(403);
  });

  it('should return 409 when target user is already a member', async () => {
    // First call: requester IS a member. Second call: target IS a member too.
    mockIsGroupMember
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const res = await POST(makePostRequest({ userId: FRIEND_ID }), routeParams);
    expect(res.status).toBe(409);

    const data = await res.json();
    expect(data.error).toBe('User is already a member of this group');
  });

  it('should return 201 on success', async () => {
    // First call: requester IS a member. Second call: target is NOT a member.
    mockIsGroupMember
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const res = await POST(makePostRequest({ userId: FRIEND_ID }), routeParams);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.membership).toBeDefined();
    expect(mockAddGroupMember).toHaveBeenCalledWith({ groupId: GROUP_ID, userId: FRIEND_ID });
  });
});
