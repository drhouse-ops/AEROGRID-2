import { Express } from "express";
import { GroundMonitoringService } from "../../../services/groundMonitoringService";
import { SatelliteContextService } from "../../../services/satelliteContextService";
import { WeatherContextService } from "../../../services/weatherContextService";
import { FirmsService } from "../../../services/firmsService";

/**
 * Health + environmental-context routes.
 * GET /api/health, /api/v1/health
 * GET /api/v1/environment/context
 */
export function registerHealthRoutes(app: Express, deps: { DEMO_MODE: boolean }): void {
  const handleHealth = (_req: any, res: any) => {
    try {
      res.json({
        status: "HEALTHY",
        region: "pune-pilot-01",
      });
    } catch (err) {
      res.status(500).json({ status: "UNHEALTHY" });
    }
  };

  app.get("/api/health", handleHealth);
  app.get("/api/v1/health", handleHealth);

  app.get("/api/v1/environment/context", async (req, res) => {
    const queryLat = req.query.latitude;
    const queryLng = req.query.longitude;

    const lat = typeof queryLat === "string" ? parseFloat(queryLat) : NaN;
    const lng = typeof queryLng === "string" ? parseFloat(queryLng) : NaN;

    const errors: string[] = [];
    if (queryLat === undefined || queryLat === null || queryLat === "") {
      errors.push("Latitude is missing");
    } else if (isNaN(lat) || !Number.isFinite(lat)) {
      errors.push("Latitude must be a finite number");
    } else if (lat < -90 || lat > 90) {
      errors.push("Latitude must be between -90 and 90");
    }

    if (queryLng === undefined || queryLng === null || queryLng === "") {
      errors.push("Longitude is missing");
    } else if (isNaN(lng) || !Number.isFinite(lng)) {
      errors.push("Longitude must be a finite number");
    } else if (lng < -180 || lng > 180) {
      errors.push("Longitude must be between -180 and 180");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "INVALID_COORDINATES",
        details: errors,
      });
    }

    const eventType = req.query.eventType as string;

    const groundMonitoring = await GroundMonitoringService.getContext(lat, lng, eventType);
    const satelliteContext = SatelliteContextService.getContext(lat, lng);
    const weatherContext = await WeatherContextService.getContext(lat, lng);

    const isCombustion = eventType === "OPEN_WASTE_BURNING" || eventType === "INDUSTRIAL_SMOKE";
    let thermalContext = undefined;

    if (isCombustion) {
      thermalContext = await FirmsService.getThermalContext(lat, lng);
    }

    res.json({
      groundMonitoring,
      satelliteContext,
      weatherContext,
      ...(thermalContext ? { thermalContext } : {}),
    });
  });
}
