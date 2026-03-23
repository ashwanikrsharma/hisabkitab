import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID, GROUP_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
  GROUP_ID: '33333333-3333-3333-3333-333333333333',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockMemberships = vi.hoisted(() => vi.fn());
const mockTableQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  getServerClient: () => ({
    from: (table: string) => {
      if (table === 'group_members') {
        return {
          select: (cols: string) => {
            if (cols === 'group_id') {
              // memberships query
              return {
                eq: () => ({
                  eq: () => mockMemberships(),
                }),
              };
            }
            // other group_members queries (for pull)
            return {
              in: () => ({
                gt: () => mockTableQuery(),
              }),
              eq: () => ({
                eq: () => ({
                  eq: () => mockMemberships(),
                }),
              }),
            };
          },
        };
      }
      // Generic table queries for sync/pull
      return {
        select: () => ({
          in: () => ({
            gt: () => mockTableQuery(),
          }),
          is: () => ({
            or: () => ({
              gt: () => mockTableQuery(),
            }),
          }),
          eq: () => ({
            is: () => ({
              gt: () => mockTableQuery(),
            }),
          }),
          gt: () => mockTableQuery(),
        }),
      };
    },
  }),
}));

import { GET } from './route';

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/sync/pull');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockMemberships.mockReturnValue({
    data: [{ group_id: GROUP_ID }],
    error: null,
  });
  mockTableQuery.mockReturnValue({ data: [], error: null });
});

describe('GET /api/sync/pull', () => {
  it('should return 400 when since param is missing', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
  });

  it('should return 400 when since is not a valid timestamp', async () => {
    const res = await GET(makeGetRequest({ since: 'not-a-date' }));
    expect(res.status).toBe(400);
  });

  it('should return 200 with changes and timestamp on success', async () => {
    const res = await GET(makeGetRequest({ since: '2024-01-01T00:00:00Z' }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.changes).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  it('should support filtering by specific tables', async () => {
    const res = await GET(makeGetRequest({
      since: '2024-01-01T00:00:00Z',
      tables: 'groups,expenses',
    }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.changes).toBeDefined();
  });

  it('should return 500 when memberships query fails', async () => {
    mockMemberships.mockReturnValueOnce({
      data: null,
      error: { message: 'DB error' },
    });

    const res = await GET(makeGetRequest({ since: '2024-01-01T00:00:00Z' }));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to fetch user groups');
  });
});
