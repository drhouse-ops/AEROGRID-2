import { Express } from "express";
import { serverState, resetDatabase, emitSignalStreamEvent } from "../serverState";

/**
 * Hotspot query + municipal dispatch routes.
 * GET  /api/v1/hotspots
 * GET  /api/v1/hotspots/:id
 * POST /api/v1/incidents/:id/dispatch
 * POST /api/v1/incidents/:id/acknowledge
 * POST /api/v1/incidents/:id/resolve
 * POST /api/v1/incidents/:id/dismiss
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

    const dispatchedAt = new Date().toISOString();
    hotspot.dispatch = {
      teamName: teamName || "Environmental Response Team 02",
      status: "EN_ROUTE",
      etaMinutes: 18,
      timestamp: dispatchedAt,
      acknowledgedAt: hotspot.dispatch?.acknowledgedAt || dispatchedAt,
      dispatchedAt,
    };

    console.log(`Dispatched team: ${teamName} to Hotspot: ${id}`);
    emitSignalStreamEvent({ type: "hotspot_dispatched", hotspotId: id, dispatch: hotspot.dispatch, at: dispatchedAt });
    res.json({ success: true, hotspot });
  });

  app.post("/api/v1/incidents/:id/acknowledge", (req, res) => {
    if (!DEMO_MODE) {
      return res.status(503).json({
        success: false,
        error: "MUNICIPAL_DISPATCH_NOT_CONNECTED",
        disclosure: "MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED",
      });
    }

    const id = req.params.id;
    const hotspot = serverState.hotspots.find((h) => h.id === id);
    if (!hotspot) {
      return res.status(404).json({ error: "Incident not found." });
    }

    const acknowledgedAt = new Date().toISOString();
    hotspot.dispatch = {
      ...(hotspot.dispatch || {}),
      status: hotspot.dispatch?.status && hotspot.dispatch.status !== "AVAILABLE" ? hotspot.dispatch.status : "ACKNOWLEDGED",
      acknowledgedAt,
    };

    emitSignalStreamEvent({ type: "hotspot_dispatched", hotspotId: id, dispatch: hotspot.dispatch, at: acknowledgedAt });
    res.json({ success: true, hotspot });
  });

  app.post("/api/v1/incidents/:id/resolve", (req, res) => {
    if (!DEMO_MODE) {
      return res.status(503).json({
        success: false,
        error: "MUNICIPAL_DISPATCH_NOT_CONNECTED",
        disclosure: "MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED",
      });
    }

    const id = req.params.id;
    const { outcome } = req.body;
    const hotspot = serverState.hotspots.find((h) => h.id === id);
    if (!hotspot) {
      return res.status(404).json({ error: "Incident not found." });
    }

    const resolvedAt = new Date().toISOString();
    hotspot.dispatch = {
      ...(hotspot.dispatch || {}),
      status: "RESOLVED",
      resolvedAt,
      outcome: outcome || "RESOLVED_BY_FIELD_TEAM",
    };

    emitSignalStreamEvent({ type: "hotspot_resolved", hotspotId: id, resolution: hotspot.dispatch, at: resolvedAt });
    res.json({ success: true, hotspot });
  });

  app.post("/api/v1/incidents/:id/dismiss", (req, res) => {
    if (!DEMO_MODE) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN_IN_LIVE_MODE",
        message: "False-positive dismissal is disabled in live pilot mode.",
      });
    }

    const id = req.params.id;
    const { reason } = req.body;
    const hotspot = serverState.hotspots.find((h) => h.id === id);
    if (!hotspot) {
      return res.status(404).json({ error: "Incident not found." });
    }

    const dismissedAt = new Date().toISOString();
    hotspot.dismissed = true;
    hotspot.dismissedReason = reason || "MARKED_FALSE_POSITIVE_BY_OPERATOR";
    hotspot.dismissedAt = dismissedAt;
    serverState.hotspots = serverState.hotspots.filter((h) => h.id !== id);

    emitSignalStreamEvent({ type: "hotspot_dismissed", hotspotId: id, reason: hotspot.dismissedReason, at: dismissedAt });
    res.json({ success: true, message: "Signal dismissed as false positive.", hotspotId: id });
  });
}
