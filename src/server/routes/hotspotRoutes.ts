import { Express } from "express";
import { serverState, resetDatabase } from "../serverState";

/**
 * Hotspot query + municipal dispatch routes.
 * GET  /api/v1/hotspots
 * GET  /api/v1/hotspots/:id
 * POST /api/v1/incidents/:id/dispatch
 * POST /api/v1/demo/reset
 */
export function registerHotspotRoutes(app: Express, deps: { DEMO_MODE: boolean }): void {
  const { DEMO_MODE } = deps;

  app.post("/api/v1/demo/reset", (_req, res) => {
    if (!DEMO_MODE) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN_IN_LIVE_MODE",
        message: "Demo state reset is blocked in live pilot mode.",
      });
    }
    resetDatabase();
    res.json({ success: true, message: "Demo state reset successfully." });
  });

  app.get("/api/v1/hotspots", (_req, res) => {
    res.json(serverState.hotspots);
  });

  app.get("/api/v1/hotspots/:id", (req, res) => {
    const id = req.params.id;
    const hotspot = serverState.hotspots.find((h) => h.id === id);
    if (!hotspot) {
      return res.status(404).json({ error: "Hotspot not found." });
    }
    res.json(hotspot);
  });

  app.post("/api/v1/incidents/:id/dispatch", (req, res) => {
    if (!DEMO_MODE) {
      return res.status(503).json({
        success: false,
        error: "MUNICIPAL_DISPATCH_NOT_CONNECTED",
        disclosure: "MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED",
      });
    }

    const id = req.params.id;
    const { teamName } = req.body;
    const hotspot = serverState.hotspots.find((h) => h.id === id);
    if (!hotspot) {
      return res.status(404).json({ error: "Incident not found." });
    }

    hotspot.dispatch = {
      teamName: teamName || "Environmental Response Team 02",
      status: "EN_ROUTE",
      etaMinutes: 18,
      timestamp: new Date().toISOString(),
    };

    console.log(`Dispatched team: ${teamName} to Hotspot: ${id}`);
    res.json({ success: true, hotspot });
  });
}
