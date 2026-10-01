import { dbManager } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      const initialPayload = JSON.stringify({
        type: 'CONNECTED',
        state: dbManager.getState(),
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${initialPayload}\n\n`));

      // Subscribe to database changes
      const unsubscribe = dbManager.subscribe((newState) => {
        try {
          const payload = JSON.stringify({
            type: 'STATE_CHANGED',
            state: newState,
            timestamp: new Date().toISOString(),
          });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch (err) {
          console.error('[SSE] Failed to enqueue state change:', err);
        }
      });

      // Heartbeat ping every 15 seconds to prevent browser/proxy connection drop
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(interval);
          unsubscribe();
        }
      }, 15000);

      // Listen for client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
