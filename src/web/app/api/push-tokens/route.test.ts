import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const FAKE_USER_ID = vi.hoisted(() => '11111111-1111-1111-1111-111111111111');

const mockRequireAuth = vi.hoisted(() => vi.fn());
const mockRegisterPushToken = vi.hoisted(() => vi.fn());
const mockDeactivatePushToken = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@hisabkitab/services', () => ({
  registerPushToken: mockRegisterPushToken,
  deactivatePushToken: mockDeactivatePushToken,
}));

import { POST, DELETE } from './route';

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/push-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/push-tokens', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: FAKE_USER_ID, email: 'test@example.com' });
  mockRegisterPushToken.mockResolvedValue({
    id: 'pt-1',
    user_id: FAKE_USER_ID,
    token: 'ExponentPushToken[abc123]',
    platform: 'ios',
  });
  mockDeactivatePushToken.mockResolvedValue(undefined);
});

describe('POST /api/push-tokens', () => {
  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

    await expect(POST(makePostRequest({ token: 'abc', platform: 'ios' }))).rejects.toBeDefined();
  });

  it('should return 400 when token is missing', async () => {
    const res = await POST(makePostRequest({ platform: 'ios' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when platform is missing', async () => {
    const res = await POST(makePostRequest({ token: 'ExponentPushToken[abc123]' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when platform is invalid', async () => {
    const res = await POST(makePostRequest({ token: 'abc', platform: 'windows' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when token is empty string', async () => {
    const res = await POST(makePostRequest({ token: '', platform: 'ios' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/push-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 201 on success with required fields', async () => {
    const res = await POST(makePostRequest({ token: 'ExponentPushToken[abc123]', platform: 'ios' }));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.pushToken).toBeDefined();
    expect(mockRegisterPushToken).toHaveBeenCalledWith(
      FAKE_USER_ID,
      'ExponentPushToken[abc123]',
      'ios',
      undefined,
    );
  });

  it('should return 201 on success with optional deviceId', async () => {
    const res = await POST(makePostRequest({
      token: 'ExponentPushToken[abc123]',
      platform: 'android',
      deviceId: 'device-xyz',
    }));
    expect(res.status).toBe(201);

    expect(mockRegisterPushToken).toHaveBeenCalledWith(
      FAKE_USER_ID,
      'ExponentPushToken[abc123]',
      'android',
      'device-xyz',
    );
  });

  it('should return 500 when registerPushToken throws', async () => {
    mockRegisterPushToken.mockRejectedValueOnce(new Error('DB error'));

    const res = await POST(makePostRequest({ token: 'abc', platform: 'web' }));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to register push token');
  });
});

describe('DELETE /api/push-tokens', () => {
  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

    await expect(DELETE(makeDeleteRequest({ token: 'abc' }))).rejects.toBeDefined();
  });

  it('should return 400 when token is missing', async () => {
    const res = await DELETE(makeDeleteRequest({}));
    expect(res.status).toBe(400);
  });

  it('should return 400 when token is empty string', async () => {
    const res = await DELETE(makeDeleteRequest({ token: '' }));
    expect(res.status).toBe(400);
  });

  it('should return 200 on success', async () => {
    const res = await DELETE(makeDeleteRequest({ token: 'ExponentPushToken[abc123]' }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockDeactivatePushToken).toHaveBeenCalledWith(FAKE_USER_ID, 'ExponentPushToken[abc123]');
  });

  it('should return 500 when deactivatePushToken throws', async () => {
    mockDeactivatePushToken.mockRejectedValueOnce(new Error('DB error'));

    const res = await DELETE(makeDeleteRequest({ token: 'abc' }));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe('Failed to deactivate push token');
  });
});
