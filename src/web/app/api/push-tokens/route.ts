import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { registerPushToken, deactivatePushToken } from '@hisabkitab/services';

const RegisterPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  deviceId: z.string().optional(),
});

const DeactivatePushTokenSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);

  const body = await req.json().catch(() => null);
  const parsed = RegisterPushTokenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const pushToken = await registerPushToken(
      user.id,
      parsed.data.token,
      parsed.data.platform,
      parsed.data.deviceId,
    );

    return Response.json({ pushToken }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/push-tokens]', err);
    return Response.json({ error: 'Failed to register push token' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);

  const body = await req.json().catch(() => null);
  const parsed = DeactivatePushTokenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await deactivatePushToken(user.id, parsed.data.token);

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[DELETE /api/push-tokens]', err);
    return Response.json({ error: 'Failed to deactivate push token' }, { status: 500 });
  }
}
