import { NextRequest } from 'next/server';
import {
  getBaileysStatus,
  connectBaileys,
  onBaileysEvent,
} from '../../../../server/baileysManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Keep lambda execution alive up to 60 seconds during QR scan

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || undefined;
  const phone = searchParams.get('phone') || undefined;
  const force = searchParams.get('force') === 'true';

  // Trigger Baileys connection (supports pairing code phone or QR mode)
  connectBaileys({
    userId,
    phoneForPairing: phone,
    forceRestart: force || Boolean(phone),
  }).catch((err) => {
    console.warn('SSE trigger connect error:', err);
  });

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  let isClosed = false;

  const safeWrite = async (chunk: string) => {
    if (isClosed) return;
    try {
      await writer.write(encoder.encode(chunk));
    } catch {
      isClosed = true;
    }
  };

  // 1. Send initial status immediately
  const initialStatus = getBaileysStatus();
  safeWrite(`data: ${JSON.stringify({ type: 'init', ...initialStatus })}\n\n`);

  // 2. Listen to real-time Baileys events (QR code, connected, error, etc.)
  const unsubscribe = onBaileysEvent((evt) => {
    safeWrite(`data: ${JSON.stringify(evt)}\n\n`);
  });

  // 3. Keepalive ping every 2.5s so Vercel does not terminate or freeze the lambda container
  const pingInterval = setInterval(() => {
    safeWrite(': keepalive\n\n');
  }, 2500);

  // 4. Cleanup when client disconnects or aborts
  req.signal.addEventListener('abort', () => {
    isClosed = true;
    clearInterval(pingInterval);
    unsubscribe();
    try {
      writer.close();
    } catch {}
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
