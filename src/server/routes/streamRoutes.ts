import { Express } from "express";
import { subscribeSignalStream } from "../serverState";

/**
 * Server-Sent Events (SSE) live signal stream.
 * GET /api/v1/stream  -> text/event-stream of real-time report/hotspot events.
 *
 * This powers the Municipal Desk "Live Signal Stream" so a jury can watch
 * correlated evidence arrive and hotspots get promoted in real time.
 */
export function registerStreamRoutes(app: Express): void {
  app.get("/api/v1/stream", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 3000\n\n");
    res.write(`event: hello\ndata: ${JSON.stringify({ type: "connected", at: new Date().toISOString() })}\n\n`);

    const send = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const unsubscribe = subscribeSignalStream((event) => {
      send(event);
    });

    // Heartbeat to keep the connection alive through proxies.
    const heartbeat = setInterval(() => {
      res.write(`event: ping\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
