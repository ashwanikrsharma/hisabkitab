import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * POST /api/webhooks/whatsapp
 * Receives WhatsApp Business webhook events from Meta.
 *
 * SECURITY: X-Hub-Signature-256 verification MUST be performed before processing
 * any payload. This prevents spoofed webhook calls.
 *
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */

/**
 * Verifies the X-Hub-Signature-256 header from Meta.
 * @throws if signature is missing or invalid
 */
function verifyWhatsAppSignature(payload: string, signatureHeader: string | null): void {
  if (!signatureHeader) {
    throw new Error('Missing X-Hub-Signature-256 header');
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    throw new Error('WHATSAPP_APP_SECRET not configured');
  }

  const expectedSignature = createHmac('sha256', appSecret).update(payload).digest('hex');
  const expected = Buffer.from(`sha256=${expectedSignature}`, 'utf8');
  const received = Buffer.from(signatureHeader, 'utf8');

  // Use timing-safe comparison to prevent timing attacks
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('Invalid X-Hub-Signature-256 signature');
  }
}

/**
 * GET — Meta webhook verification challenge
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST — Incoming WhatsApp messages and status updates
 */
export async function POST(req: NextRequest) {
  // SECURITY: Verify X-Hub-Signature-256 BEFORE reading or processing the payload
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  try {
    verifyWhatsAppSignature(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[WhatsApp webhook] Signature error:', message);
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // TODO: Process WhatsApp message events
  // - Extract message text from body.entry[0].changes[0].value.messages[0]
  // - Look up user by phone number
  // - Save expense to DB via @hisabkitab/db
  // - Reply with confirmation via WhatsApp API

  void body; // Remove when implementing

  // Always return 200 to prevent Meta from retrying
  return Response.json({ status: 'ok' });
}
