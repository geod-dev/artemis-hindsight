import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { subscribeToListChanges } from "@/server/events/list-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxies and the browser drop an idle connection; a comment line every 25 seconds keeps it open.
const HEARTBEAT_MS = 25_000;

/**
 * The signed-in user's list changes, as a stream (text/event-stream). A `changed` event means one of the user's lists
 * changed, in some window or on some device: the client reads the lists again. Nothing else is sent. The web app
 * (EventSource, cookie) and the mobile app (bearer token) both read it.
 */
export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const encoder = new TextEncoder();
  let close: () => void = () => undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (text: string) => {
        if (open) controller.enqueue(encoder.encode(text));
      };

      const unsubscribe = subscribeToListChanges(user.id, () => send("event: changed\ndata: {}\n\n"));
      const heartbeat = setInterval(() => send(": keep-alive\n\n"), HEARTBEAT_MS);

      close = () => {
        if (!open) return;
        open = false;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };

      send("retry: 3000\n\n");
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
