import { getAuthUser } from '@/server/auth';
import { subscribe, type RealtimeEvent } from '@/server/realtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Server-Sent Events stream: real-time notifications + refresh hints (§38, no heavy polling). */
export async function GET(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* client gone */
        }
      };
      send({ type: 'refresh', topic: 'connected' });
      unsubscribe = subscribe(user.id, send);
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          /* noop */
        }
      }, 25000);
      req.signal.addEventListener('abort', () => {
        unsubscribe?.();
        if (ping) clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
