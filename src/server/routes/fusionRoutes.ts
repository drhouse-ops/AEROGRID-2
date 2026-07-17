import { Express } from "express";
import { GroundMonitoringService } from "../../../services/groundMonitoringService";
import { SatelliteContextService } from "../../../services/satelliteContextService";
import { SignalFusionService } from "../../../services/signalFusionService";
import { FirmsService } from "../../../services/firmsService";
import { WeatherContextService } from "../../../services/weatherContextService";
import { FUSION_CONFIG, resolveBandedScore, resolveCitizenCorrelation } from "../../config/fusionConfig";
import { serverState, SEEDED_REPORT, persistReport, persistHotspot, emitSignalStreamEvent } from "../serverState";

/**
 * Signal-fusion evaluation route. Deterministic evidence-convergence engine.
 * Accepts a citizen report, correlates it against prior observations, and promotes
 * a High-Confidence Signal when convergence criteria are met.
 * POST /api/v1/fusion/evaluate
 */
export function registerFusionRoutes(app: Express, deps: { DEMO_MODE: boolean }): void {
  const { DEMO_MODE } = deps;

  app.post("/api/v1/fusion/evaluate", async (req, res) => {
    const { report } = req.body;

    const details: string[] = [];
    if (!report) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REPORT_INPUT",
        details: ["VALID_LATITUDE_REQUIRED", "VALID_LONGITUDE_REQUIRED", "ANALYSIS_REQUIRED", "RESOLVED_EVENT_CATEGORY_REQUIRED"],
      });
    }

    const lat = report.latitude;
    const lng = report.longitude;

    const isLatValid = typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90;
    if (!isLatValid) details.push("VALID_LATITUDE_REQUIRED");

    const isLngValid = typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
    if (!isLngValid) details.push("VALID_LONGITUDE_REQUIRED");

    if (!report.analysis) details.push("ANALYSIS_REQUIRED");

    let resolvedEventType = "UNKNOWN";
    if (report.analysis) {
      const confidence = report.analysis.confidence ?? 0;
      const aiCat = report.analysis.aiDetectedCategory;
      const hasHighConfidenceAiCategory = confidence >= FUSION_CONFIG.aiCategoryConfidenceThreshold && aiCat && aiCat !== "UNKNOWN";
      resolvedEventType = hasHighConfidenceAiCategory ? aiCat : (report.categoryHint || report.analysis.eventType || "UNKNOWN");
    }

    if (!resolvedEventType || resolvedEventType === "UNKNOWN") details.push("RESOLVED_EVENT_CATEGORY_REQUIRED");

    if (details.length > 0) {
      return res.status(400).json({ success: false, error: "INVALID_REPORT_INPUT", details });
    }

    const liveReportId = `live_report_${Date.now()}`;
    const liveReportWithId = { ...report, id: liveReportId, timestamp: new Date().toISOString() };
    serverState.liveReports.push(liveReportWithId);
    void persistReport(liveReportWithId);
    emitSignalStreamEvent({ type: "report_received", report: liveReportWithId, at: new Date().toISOString() });

    const isDemoMode = DEMO_MODE;

    let correlatedReports: any[] = [];
    let liveReportCount = 1;
    let seededReportCount = 0;
    let totalReportCount = 1;
    let C = 0.0;
    let G = 0.0;
    let T = 0.0;
    let correlationExplanation = "1 live citizen observation analyzed.";

    const getHaversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const categoryCompatibility = (cat1: string, cat2: string) => {
      if (!cat1 || !cat2) return false;
      const c1 = cat1.toUpperCase();
      const c2 = cat2.toUpperCase();
      if (c1 === c2) return true;
      if ((c1 === "SMOKE" && (c2 === "OPEN_WASTE_BURNING" || c2 === "INDUSTRIAL_SMOKE")) ||
          (c2 === "SMOKE" && (c1 === "OPEN_WASTE_BURNING" || c1 === "INDUSTRIAL_SMOKE"))) {
        return true;
      }
      return false;
    };

    const confidence = liveReportWithId.analysis?.confidence ?? 0;
    const aiCat = liveReportWithId.analysis?.aiDetectedCategory;
    const hasHighConfidenceAiCategory = confidence >= FUSION_CONFIG.aiCategoryConfidenceThreshold && aiCat && aiCat !== "UNKNOWN";
    resolvedEventType = hasHighConfidenceAiCategory ? aiCat : (liveReportWithId.categoryHint || liveReportWithId.analysis?.eventType || "UNKNOWN");

    console.log(`Resolved eventType for downstream triggering: ${resolvedEventType} (hasHighConfidenceAiCategory: ${hasHighConfidenceAiCategory})`);

    if (isDemoMode) {
      const distKm = getHaversineDistanceKm(liveReportWithId.latitude, liveReportWithId.longitude, SEEDED_REPORT.latitude, SEEDED_REPORT.longitude);
      const distanceMeters = distKm * 1000;

      console.log(`Calculating signal fusion between live report and seeded report in DEMO MODE. Distance: ${distanceMeters.toFixed(1)}m`);

      correlatedReports = [liveReportWithId, SEEDED_REPORT];
      liveReportCount = 1;
      seededReportCount = 1;
      totalReportCount = 2;

      C = resolveCitizenCorrelation(1);
      G = resolveBandedScore(distanceMeters, FUSION_CONFIG.geospatialBands);
      T = resolveBandedScore(0, FUSION_CONFIG.temporalBands);
      correlationExplanation = "1 live citizen observation + 1 demo supporting observation";
    } else {
      const nowMs = Date.now();
      const matchedPriorReports = serverState.liveReports.filter((r) => {
        if (r.id === liveReportId) return false;

        const distKm = getHaversineDistanceKm(liveReportWithId.latitude, liveReportWithId.longitude, r.latitude, r.longitude);
        if (distKm > 1.0) return false;

        const rTimeMs = new Date(r.timestamp).getTime();
        const diffMins = Math.abs(nowMs - rTimeMs) / 60000;
        if (diffMins > 60) return false;

        const rConfidence = r.analysis?.confidence ?? 0;
        const rAiCat = r.analysis?.aiDetectedCategory;
        const rHasHighConfidence = rConfidence >= FUSION_CONFIG.aiCategoryConfidenceThreshold && rAiCat && rAiCat !== "UNKNOWN";
        const rResolvedType = rHasHighConfidence ? rAiCat : (r.categoryHint || r.analysis?.eventType || "UNKNOWN");

        return categoryCompatibility(resolvedEventType, rResolvedType);
      });

      correlatedReports = [liveReportWithId, ...matchedPriorReports];
      liveReportCount = correlatedReports.length;
      seededReportCount = 0;
      totalReportCount = liveReportCount;

      const n = matchedPriorReports.length;
      C = resolveCitizenCorrelation(n);

      if (n > 0) {
        let nearestDistKm = Infinity;
        let newestTimeMs = 0;
        for (const r of matchedPriorReports) {
          const d = getHaversineDistanceKm(liveReportWithId.latitude, liveReportWithId.longitude, r.latitude, r.longitude);
          if (d < nearestDistKm) nearestDistKm = d;
          const rTimeMs = new Date(r.timestamp).getTime();
          if (rTimeMs > newestTimeMs) newestTimeMs = rTimeMs;
        }

        const nearestDistMeters = nearestDistKm * 1000;
        G = resolveBandedScore(nearestDistMeters, FUSION_CONFIG.geospatialBands);

        const timeDiffMins = Math.abs(nowMs - newestTimeMs) / 60000;
        T = resolveBandedScore(timeDiffMins, FUSION_CONFIG.temporalBands);

        correlationExplanation = `${liveReportCount} live citizen observations correlated.`;
      } else {
        G = 0.0;
        T = 0.0;
        correlationExplanation = "1 live citizen observation analyzed (no correlated nearby reports found).";
      }
    }

    const isCombustion = resolvedEventType === "OPEN_WASTE_BURNING" || resolvedEventType === "INDUSTRIAL_SMOKE";
    let thermalContext = undefined;
    let thermalContextScore = undefined;

    if (isCombustion) {
      thermalContext = await FirmsService.getThermalContext(liveReportWithId.latitude, liveReportWithId.longitude);
      if (thermalContext.available) {
        if (thermalContext.detectionFound && thermalContext.nearestDetectionDistanceKm !== undefined) {
          const dist = thermalContext.nearestDetectionDistanceKm;
          const distanceScore = Math.max(0.0, Math.min(1.0, (10 - dist) / 10));
          thermalContextScore = parseFloat(distanceScore.toFixed(2));
        } else {
          thermalContextScore = 0.0;
        }
      }
    }

    const groundMonitoring = await GroundMonitoringService.getContext(liveReportWithId.latitude, liveReportWithId.longitude, resolvedEventType);
    const weatherContext = await WeatherContextService.getContext(liveReportWithId.latitude, liveReportWithId.longitude);

    const V = typeof liveReportWithId.analysis?.confidence === "number" ? liveReportWithId.analysis.confidence : 0.0;
    const S = groundMonitoring.anomalyAvailable && typeof groundMonitoring.anomalyScore === "number" ? groundMonitoring.anomalyScore : null;
    const M = (weatherContext && typeof weatherContext.persistenceScore === "number") ? weatherContext.persistenceScore : null;

    const fusionBreakdown = SignalFusionService.evaluate({
      citizenCorrelation: C,
      visualEvidenceConfidence: V,
      groundMonitoringAnomaly: S,
      geospatialCorrelation: G,
      temporalCorrelation: T,
      atmosphericPersistence: M,
      ...(thermalContextScore !== undefined ? { thermalContextScore } : {}),
    });

    const finalScore = fusionBreakdown.finalScore;

    const DEMO_FORECAST = {
      disclosure: "SIMULATED DEMO SCENARIO",
      points: [
        { time: "NOW", value: 117 },
        { time: "+3H", value: 143 },
        { time: "+6H", value: 168 },
        { time: "+12H", value: 151 },
        { time: "+18H", value: 128 },
        { time: "+24H", value: 109 },
      ],
      predictedSpikeTime: "+6 HOURS",
      predictedSpikeValue: 168,
      spikeRisk: 87,
      contributors: [
        "Ground pollutant anomaly (Shivajinagar anomaly spike)",
        weatherContext.available
          ? `${weatherContext.dispersionCondition} dispersion conditions (wind speed ${weatherContext.windSpeedKph !== null ? weatherContext.windSpeedKph : 1.8} kph)`
          : "Atmospheric persistence factor",
        "Persistent local smoke observations (multiple correlated reports)",
        "High environmental signal confidence index",
      ],
    };

    const promotableClassifications = new Set(["PROBABLE HOTSPOT", "HIGH-CONFIDENCE SIGNAL"]);
    const isPromoted = promotableClassifications.has(fusionBreakdown.classification);

    let actualHotspot = null;

    if (isPromoted) {
      const lats = correlatedReports.map((r) => r.latitude);
      const lngs = correlatedReports.map((r) => r.longitude);
      const centroidLat = lats.reduce((sum, val) => sum + val, 0) / lats.length;
      const centroidLng = lngs.reduce((sum, val) => sum + val, 0) / lngs.length;

      const hotspotId = `hotspot_pune_01`;
      actualHotspot = {
        id: hotspotId,
        latitude: centroidLat,
        longitude: centroidLng,
        eventType: resolvedEventType || "OPEN_WASTE_BURNING",
        severity: liveReportWithId.analysis?.severity || "HIGH",
        signalStrength: parseFloat((finalScore * 100).toFixed(0)) / 100,
        address: "Pune Central Pilot Zone (Centroid near Shivajinagar Market)",
        timestamp: new Date().toISOString(),
        reportsCount: totalReportCount,
        citizenReports: correlatedReports,
        fusion: {
          ...fusionBreakdown,
          liveReportCount,
          seededReportCount,
          totalReportCount,
          correlationExplanation,
        },
        context: {
          groundMonitoring,
          satelliteContext: SatelliteContextService.getContext(centroidLat, centroidLng),
          weatherContext,
          ...(thermalContext ? { thermalContext } : {}),
        },
        forecast: isDemoMode ? DEMO_FORECAST : {
          available: false,
          disclosure: "FORECASTING NOT AVAILABLE IN LIVE PILOT MODE",
          points: [],
        },
        dispatch: isDemoMode ? {
          teamName: "Environmental Response Team 02",
          status: "AVAILABLE",
          etaMinutes: 18,
        } : {
          available: false,
          disclosure: "MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED",
        },
      };

      serverState.hotspots.unshift(actualHotspot);
      if (serverState.hotspots.length > 100) {
        serverState.hotspots = serverState.hotspots.slice(0, 100);
      }
      void persistHotspot(actualHotspot);
      emitSignalStreamEvent({ type: "hotspot_promoted", hotspot: actualHotspot, at: new Date().toISOString() });
    }

    res.json({
      success: true,
      promoted: isPromoted,
      reportId: liveReportId,
      fusion: fusionBreakdown,
      hotspot: actualHotspot,
    });
  });
}
