import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, FRIEND_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  FRIEND_ID: '22222222-2222-2222-2222-222222222222',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockLimit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  getServerClient: () => ({
    from: () => ({
      select: () => ({
        or: () => ({
          neq: () => ({
            limit: mockLimit,
          }),
        }),
      }),
    }),
  }),
}));

import { GET } from './route';

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/users/search');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockLimit.mockResolvedValue({
    data: [{ id: FRIEND_ID, name: 'Friend', phone: '+919876543210' }],
    error: null,
  });
});

describe('GET /api/users/search', () => {
  it('should return 400 when query is missing', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('Query must be at least 2 characters');
  });

  it('should return 400 when query is too short', async () => {
    const res = await GET(makeGetRequest({ q: 'a' }));
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('Query must be at least 2 characters');
  });

  it('should return 200 with matching users', async () => {
    const res = await GET(makeGetRequest({ q: 'Friend' }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.users).toHaveLength(1);
    expect(data.users[0].id).toBe(FRIEND_ID);
  });

  it('should return 200 with empty array when no matches', async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null });

    const res = await GET(makeGetRequest({ q: 'Nobody' }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.users).toEqual([]);
  });

  it('should return 500 when DB query fails', async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const res = await GET(makeGetRequest({ q: 'Friend' }));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Search failed');
  });
});
