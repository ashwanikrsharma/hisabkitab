import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { FAKE_USER_ID } = vi.hoisted(() => ({
  FAKE_USER_ID: '11111111-1111-1111-1111-111111111111',
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockCreateActivity = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockInsertSingle = vi.hoisted(() => vi.fn());
const mockUpdateSingle = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  createActivity: mockCreateActivity,
  getServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
          single: mockUpdateSingle,
        }),
      }),
      insert: () => ({
        select: () => ({
          single: mockInsertSingle,
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: mockUpdateSingle,
          }),
        }),
      }),
      delete: () => ({
        eq: mockDelete,
      }),
    }),
  }),
}));

import { POST } from './route';

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockCreateActivity.mockResolvedValue({ id: 'activity-1' });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockInsertSingle.mockResolvedValue({ data: { id: 'record-1' }, error: null });
  mockUpdateSingle.mockResolvedValue({ data: { id: 'record-1' }, error: null });
  mockDelete.mockResolvedValue({ error: null });
});

describe('POST /api/sync/push', () => {
  it('should return 400 when body is invalid', async () => {
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
  });

  it('should return 400 when device_id is missing', async () => {
    const res = await POST(makePostRequest({ operations: [] }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when operations have invalid table name', async () => {
    const res = await POST(makePostRequest({
      device_id: 'device-1',
      operations: [{
        id: 'op-1',
        operation: 'create',
        table: 'invalid_table',
        record_id: 'rec-1',
        data: {},
        client_updated_at: new Date().toISOString(),
      }],
    }));
    expect(res.status).toBe(400);
  });

  it('should return 200 with results for valid operations', async () => {
    const res = await POST(makePostRequest({
      device_id: 'device-1',
      operations: [{
        id: 'op-1',
        operation: 'create',
        table: 'expenses',
        record_id: 'rec-1',
        data: { description: 'Test', amount: 100 },
        client_updated_at: new Date().toISOString(),
      }],
    }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results).toHaveLength(1);
  });

  it('should return 200 with empty results for empty operations array', async () => {
    const res = await POST(makePostRequest({
      device_id: 'device-1',
      operations: [],
    }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.results).toEqual([]);
  });

  // Regression: 'users' was missing from ALLOWED_TABLES causing 400 on profile sync push
  it('should accept "users" as a valid table (regression: sync push 400 bug)', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'user-1', name: 'Old Name', updated_at: '2026-01-01T00:00:00Z' },
      error: null,
    });
    mockUpdateSingle.mockResolvedValueOnce({
      data: { id: 'user-1', name: 'New Name' },
      error: null,
    });

    const res = await POST(makePostRequest({
      device_id: 'device-1',
      operations: [{
        id: 'op-user-1',
        operation: 'update',
        table: 'users',
        record_id: 'user-1',
        data: { name: 'New Name', default_currency: 'INR' },
        client_updated_at: new Date().toISOString(),
      }],
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toBe('ok');
  });

  it('should succeed for profile update sync push with name and default_currency', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: FAKE_USER_ID, name: 'Old Name', default_currency: 'USD', updated_at: '2026-01-01T00:00:00Z' },
      error: null,
    });
    mockUpdateSingle.mockResolvedValueOnce({
      data: { id: FAKE_USER_ID, name: 'New Name', default_currency: 'INR', updated_at: '2026-03-23T00:00:00Z' },
      error: null,
    });

    const res = await POST(makePostRequest({
      device_id: 'device-profile-1',
      operations: [{
        id: 'op-profile-update-1',
        operation: 'update',
        table: 'users',
        record_id: FAKE_USER_ID,
        data: { name: 'New Name', default_currency: 'INR' },
        client_updated_at: new Date().toISOString(),
      }],
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toBe('ok');
    expect(data.results[0].server_data).toMatchObject({ name: 'New Name', default_currency: 'INR' });
  });

  it('should accept user update with upi_id for backward compat (stale sync queue entries)', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: FAKE_USER_ID, name: 'Test User', upi_id: 'old@upi', updated_at: '2026-01-01T00:00:00Z' },
      error: null,
    });
    mockUpdateSingle.mockResolvedValueOnce({
      data: { id: FAKE_USER_ID, name: 'Test User', upi_id: 'new@upi', updated_at: '2026-03-23T00:00:00Z' },
      error: null,
    });

    const res = await POST(makePostRequest({
      device_id: 'device-profile-2',
      operations: [{
        id: 'op-profile-upi-1',
        operation: 'update',
        table: 'users',
        record_id: FAKE_USER_ID,
        data: { name: 'Test User', upi_id: 'new@upi' },
        client_updated_at: new Date().toISOString(),
      }],
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toBe('ok');
    expect(data.results[0].server_data).toMatchObject({ upi_id: 'new@upi' });
  });

  it('should reject tables not in ALLOWED_TABLES', async () => {
    const res = await POST(makePostRequest({
      device_id: 'device-1',
      operations: [{
        id: 'op-bad-1',
        operation: 'update',
        table: 'admin_secrets',
        record_id: 'rec-1',
        data: {},
        client_updated_at: new Date().toISOString(),
      }],
    }));

    expect(res.status).toBe(400);
  });
});
