import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockGetUserProfile = vi.hoisted(() => vi.fn());
const mockUpsertUser = vi.hoisted(() => vi.fn());
const mockUpdateUserProfile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  getUserProfile: mockGetUserProfile,
  upsertUser: mockUpsertUser,
  updateUserProfile: mockUpdateUserProfile,
}));

import { GET, PATCH } from './route';

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/users', { method: 'GET' });
}

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com', phone: '+911234567890', user_metadata: { name: 'Test User' } });
  mockGetUserProfile.mockResolvedValue({ id: FAKE_USER_ID, name: 'Test User', phone: '+911234567890' });
  mockUpsertUser.mockResolvedValue({ id: FAKE_USER_ID, name: 'Test User', phone: '+911234567890' });
  mockUpdateUserProfile.mockResolvedValue({ id: FAKE_USER_ID, name: 'Updated Name' });
});

describe('GET /api/users', () => {
  it('should return user profile on success', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user).toEqual({ id: FAKE_USER_ID, name: 'Test User', phone: '+911234567890' });
    expect(mockGetUserProfile).toHaveBeenCalledWith(FAKE_USER_ID);
  });

  it('should create profile on first sign-in when getUserProfile returns null', async () => {
    mockGetUserProfile.mockResolvedValueOnce(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    expect(mockUpsertUser).toHaveBeenCalledWith(FAKE_USER_ID, {
      phone: '+911234567890',
      name: 'Test User',
    });
  });

  it('should return 500 when getUserProfile throws', async () => {
    mockGetUserProfile.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to fetch user profile');
  });
});

describe('PATCH /api/users', () => {
  it('should return 400 for invalid body', async () => {
    const res = await PATCH(makePatchRequest({ name: '' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid avatar_url', async () => {
    const res = await PATCH(makePatchRequest({ avatar_url: 'not-a-url' }));
    expect(res.status).toBe(400);
  });

  it('should return 200 on successful update', async () => {
    const res = await PATCH(makePatchRequest({ name: 'Updated Name' }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user).toEqual({ id: FAKE_USER_ID, name: 'Updated Name' });
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(FAKE_USER_ID, expect.objectContaining({ name: 'Updated Name' }));
  });

  it('should return 500 when updateUserProfile throws', async () => {
    mockUpdateUserProfile.mockRejectedValueOnce(new Error('DB down'));

    const res = await PATCH(makePatchRequest({ name: 'Fail' }));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to update user profile');
  });
});
