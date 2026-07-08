import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

import { GroundMonitoringService } from "./services/groundMonitoringService";
import { SatelliteContextService } from "./services/satelliteContextService";
import { SignalFusionService } from "./services/signalFusionService";
import { FirmsService } from "./services/firmsService";
import { WeatherContextService } from "./services/weatherContextService";

// Load environment variables
dotenv.config();

const PORT = 3000;

// Initialize Gemini SDK if API key is present
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// In-Memory Database for prototype persistence
let liveReports: any[] = [];
let hotspots: any[] = [];

// Seeded Supporting Report Definition
const SEEDED_REPORT_ID = "prototype_report_02";
const SEEDED_REPORT = {
  id: SEEDED_REPORT_ID,
  timestamp: new Date(Date.now() - 9 * 60000).toISOString(), // 9 mins ago
  text: "High level of waste burning spotted near the market area. Huge plumes of plastic smoke.",
  language: "mr",
  latitude: 18.5238, // Pune approx 420m away from 18.5204, 73.8567
  longitude: 73.8545,
  isSeeded: true,
  imageUrl: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?auto=format&fit=crop&q=80&w=500",
  analysis: {
    eventType: "OPEN_WASTE_BURNING",
    pollutionTypes: ["SMOKE", "TOXIC_GAS"],
    visualEvidence: {
      smokeDetected: true,
      smokeDensity: "HIGH",
    },
    severity: "HIGH",
    confidence: 0.91,
    summary: "Dense black smoke with visible ground debris is highly consistent with unmanaged municipal waste combustion.",
    evidence: [
      "Dense grey/black smoke columns visible in photo",
      "Debris fire signature in close proximity to residential margins",
    ],
    analysisSource: "GEMINI_MULTIMODAL",
  },
};

// Reset databases helper
function resetDatabase() {
  liveReports = [];
  hotspots = [];
  console.log("Database state reset successfully.");
}

// Start building Express app
async function startServer() {
  const app = express();
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });
  app.use(express.json({ limit: "25mb" })); // Support larger base64 images

  // ==========================================
  // API ROUTES
  // ==========================================

  // GET healthcheck
  const handleHealth = (req: any, res: any) => {
    try {
      res.json({
        status: "HEALTHY",
        region: "pune-pilot-01"
      });
    } catch (err) {
      res.status(500).json({
        status: "UNHEALTHY"
      });
    }
  };

  app.get("/api/health", handleHealth);
  app.get("/api/v1/health", handleHealth);

  // POST Reset Demo
  app.post("/api/v1/demo/reset", (req, res) => {
    const isDemoMode = process.env.VITE_DEMO_MODE === "true";
    if (!isDemoMode) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN_IN_LIVE_MODE",
        message: "Demo state reset is blocked in live pilot mode."
      });
    }
    resetDatabase();
    res.json({ success: true, message: "Demo state reset successfully." });
  });

  // GET Environmental Context
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
        details: errors
      });
    }

    const eventType = req.query.eventType as string;

    const groundMonitoring = await GroundMonitoringService.getContext(lat, lng, eventType);
    const satelliteContext = SatelliteContextService.getContext(lat, lng);
    const weatherContext = await WeatherContextService.getContext(lat, lng);

    // Event-aware retrieval: only query FIRMS if it's a combustion event
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

  app.post("/api/v1/reports/analyze", async (req, res) => {
    const { text, image, language, selectedCategory, categoryHint, categoryLabel } = req.body;

    if (!text && !image && !selectedCategory) {
      return res.status(400).json({ error: "Missing text, image, or selectedCategory." });
    }

    console.log(`Analyzing citizen report of length: ${text?.length || 0}, language: ${language}, hasImage: ${!!image}, selectedCategory: "${selectedCategory}"`);

    // Fallback dictionary for offline/reliability mode
    const fallbackAnalysis = () => {
      const lowerText = (text || "").toLowerCase();
      let eventType = "UNKNOWN";
      let summary = "Local pollution observation submitted.";
      let evidence = ["Citizen submitted report."];
      let severity = "MODERATE";
      let confidence = 0.75;
      let smokeDetected = false;
      let smokeDensity = "NONE";

      if (lowerText.includes("कचरा") || lowerText.includes("कचरा जाळत") || lowerText.includes("waste") || lowerText.includes("burn") || lowerText.includes("burning")) {
        eventType = "OPEN_WASTE_BURNING";
        severity = "HIGH";
        confidence = 0.89;
        smokeDetected = true;
        smokeDensity = "HIGH";
        summary = "Dense visible smoke is consistent with possible open waste burning.";
        evidence = [
          "Citizen reports waste burning and heavy smoke.",
          "Image/context supports unmanaged open combustion signals."
        ];
      } else if (lowerText.includes("dust") || lowerText.includes("धूळ") || lowerText.includes("construction") || lowerText.includes("काम")) {
        eventType = "CONSTRUCTION_DUST";
        severity = "HIGH";
        confidence = 0.82;
        smokeDetected = false;
        summary = "Suspended particulate cloud consistent with construction activities.";
        evidence = [
          "Citizen reported construction dust emissions.",
          "Visual analysis indicates coarse dust layers."
        ];
      } else if (lowerText.includes("traffic") || lowerText.includes("गाड्या") || lowerText.includes("smog") || lowerText.includes("धूर")) {
        eventType = "TRAFFIC_SMOG";
        severity = "MODERATE";
        confidence = 0.80;
        smokeDetected = true;
        smokeDensity = "MODERATE";
        summary = "Accumulated vehicular smog in low-dispersion wind window.";
        evidence = [
          "Heavy morning traffic reports.",
          "Visual haze layer observed."
        ];
      } else if (lowerText.includes("smoke") || lowerText.includes("धूर")) {
        eventType = "INDUSTRIAL_SMOKE";
        severity = "HIGH";
        confidence = 0.85;
        smokeDetected = true;
        smokeDensity = "HIGH";
        summary = "Thick chimney or stack exhaust consistent with industrial emissions.";
        evidence = [
          "Citizen reports heavy localized stack smoke.",
          "Plume dispersion indicates high emissions flow."
        ];
      } else if (categoryHint && categoryHint !== "UNKNOWN") {
        eventType = categoryHint;
        if (eventType === "SMOKE") {
          summary = "Dense or unusual smoke visible nearby.";
          evidence = ["Citizen reported dense smoke."];
          severity = "MODERATE";
          confidence = 0.80;
          smokeDetected = true;
          smokeDensity = "HIGH";
        } else if (eventType === "UNUSUAL_AIR") {
          summary = "Strong chemical, burning, or unusual smell detected.";
          evidence = ["Citizen reported bad smell / unusual air quality."];
          severity = "MODERATE";
          confidence = 0.75;
          smokeDetected = false;
          smokeDensity = "NONE";
        } else if (eventType === "OPEN_WASTE_BURNING") {
          severity = "HIGH";
          confidence = 0.89;
          smokeDetected = true;
          smokeDensity = "HIGH";
          summary = "Dense visible smoke is consistent with possible open waste burning.";
          evidence = [
            "Citizen reports waste burning and heavy smoke.",
            "Image/context supports unmanaged open combustion signals."
          ];
        } else if (eventType === "CONSTRUCTION_DUST") {
          severity = "HIGH";
          confidence = 0.82;
          smokeDetected = false;
          summary = "Suspended particulate cloud consistent with construction activities.";
          evidence = [
            "Citizen reported construction dust emissions.",
            "Visual analysis indicates coarse dust layers."
          ];
        } else if (eventType === "TRAFFIC_SMOG") {
          severity = "MODERATE";
          confidence = 0.80;
          smokeDetected = true;
          smokeDensity = "MODERATE";
          summary = "Accumulated vehicular smog in low-dispersion wind window.";
          evidence = [
            "Heavy morning traffic reports.",
            "Visual haze layer observed."
          ];
        } else if (eventType === "DUST_EMISSION") {
          severity = "MODERATE";
          confidence = 0.78;
          smokeDetected = false;
          summary = "Suspended road dust cloud consistent with heavy traffic on dusty roads.";
          evidence = ["Citizen reports heavy road dust."];
        }
      }

      let aiDetectedCategory = eventType;
      let citizenSelectedCategory = selectedCategory || "";
      let categoryAgreement = "INSUFFICIENT_EVIDENCE";
      let categoryConflictReason = null;

      if (categoryHint) {
        if (aiDetectedCategory === categoryHint) {
          categoryAgreement = "AGREES";
        } else if (aiDetectedCategory === "UNKNOWN") {
          categoryAgreement = "INSUFFICIENT_EVIDENCE";
        } else if (categoryHint === "UNKNOWN") {
          categoryAgreement = "AGREES";
        } else {
          categoryAgreement = "CONFLICT";
          categoryConflictReason = `Visual evidence indicates ${aiDetectedCategory.replace(/_/g, " ").toLowerCase()} rather than ${(categoryLabel || categoryHint).toLowerCase()}.`;
        }
      } else {
        categoryAgreement = aiDetectedCategory !== "UNKNOWN" ? "AGREES" : "INSUFFICIENT_EVIDENCE";
      }

      return {
        eventType,
        pollutionTypes: ["SMOKE", "PM2.5"],
        visualEvidence: {
          smokeDetected,
          smokeDensity,
        },
        severity,
        confidence,
        summary,
        evidence,
        analysisSource: "DEMO_FALLBACK" as const,
        selectedCategory,
        categoryHint,
        categoryLabel,
        categoryAgreement,
        citizenSelectedCategory,
        aiDetectedCategory,
        categoryConflictReason
      };
    };

    const isDemoOnly = process.env.DEMO_ONLY === "true" || process.env.VITE_DEMO_ONLY === "true";

    // If Gemini key is available and DEMO_ONLY is not active, run actual Gemini Multimodal evaluation
    if (ai && !isDemoOnly) {
      try {
        console.log("Invoking Gemini model 'gemini-3.5-flash'...");
        const contents: any[] = [];

        // Prompt definition with rigid instructions and JSON guidelines
        const prompt = `
          You are an environmental incident evidence extraction system.
          Analyze only the supplied citizen statement and environmental image if provided.
          
          Distinguish OBSERVATION from INFERENCE.
          Never infer PM2.5 concentration from an image.
          Never claim chemical pollutant confirmation from visual evidence.
          Never claim that a waste fire is verified solely from an image.
          Use language such as "consistent with", "possible", "visible evidence indicates".
          Return UNKNOWN when evidence is insufficient.

          Citizen Text Statement: "${text || ""}"
          Selected Language: ${language || "en"}

          The citizen selected the following incident category as contextual input. Independently analyze the available visual and textual evidence. Do not assume the selected category is correct.
          Citizen-provided selectedCategory: "${selectedCategory || ""}"
          Citizen-provided categoryHint: "${categoryHint || ""}"
          Citizen-provided categoryLabel: "${categoryLabel || ""}"

          Compare the categoryHint (citizen's selection) with the eventType you independently determine.
          Determine:
          1. "categoryAgreement":
             - If your detected eventType matches categoryHint, return "AGREES".
             - If you determine eventType is "UNKNOWN", return "INSUFFICIENT_EVIDENCE".
             - If categoryHint is "UNKNOWN" (which corresponds to "Other / New Issue"), return "AGREES" (since they didn't assert a specific category, so no conflict is possible).
             - Otherwise, if your detected eventType is different from categoryHint, return "CONFLICT".
          2. "citizenSelectedCategory": Pass back the citizen-provided selectedCategory / categoryHint.
          3. "aiDetectedCategory": This MUST be the eventType you independently detected.
          4. "categoryConflictReason": If categoryAgreement is "CONFLICT", provide a clear string explanation (e.g. "Visual evidence indicates dense dark smoke and possible combustion rather than airborne construction dust."). If there is no conflict, this must be null.

          You MUST return valid structured JSON conforming EXACTLY to the following TypeScript interface:
          {
            "eventType": "OPEN_WASTE_BURNING" | "DUST_EMISSION" | "TRAFFIC_SMOG" | "INDUSTRIAL_SMOKE" | "CONSTRUCTION_DUST" | "UNKNOWN" | "SMOKE" | "UNUSUAL_AIR",
            "pollutionTypes": string[],
            "visualEvidence": {
              "smokeDetected": boolean,
              "smokeDensity": "LOW" | "MODERATE" | "HIGH" | "NONE"
            },
            "severity": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
            "confidence": number, // floating point between 0.0 and 1.0
            "summary": string,
            "evidence": string[],
            "categoryAgreement": "AGREES" | "CONFLICT" | "INSUFFICIENT_EVIDENCE",
            "citizenSelectedCategory": string,
            "aiDetectedCategory": "OPEN_WASTE_BURNING" | "DUST_EMISSION" | "TRAFFIC_SMOG" | "INDUSTRIAL_SMOKE" | "CONSTRUCTION_DUST" | "UNKNOWN" | "SMOKE" | "UNUSUAL_AIR",
            "categoryConflictReason": string | null
          }
        `;

        contents.push({ text: prompt });

        // Add base64 image part if available
        if (image) {
          const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

          contents.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: { parts: contents },
          config: {
            responseMimeType: "application/json",
          },
        });

        const rawText = response.text || "";
        console.log("Gemini response of length received and successfully parsed.");

        const cleanJsonStr = rawText.trim().replace(/^```json/, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleanJsonStr);
        parsed.analysisSource = "GEMINI_MULTIMODAL";
        if (!parsed.selectedCategory) parsed.selectedCategory = selectedCategory || "";
        if (!parsed.categoryHint) parsed.categoryHint = categoryHint || "";
        if (!parsed.categoryLabel) parsed.categoryLabel = categoryLabel || "";
        if (!parsed.citizenSelectedCategory) parsed.citizenSelectedCategory = selectedCategory || "";
        if (!parsed.aiDetectedCategory) parsed.aiDetectedCategory = parsed.eventType || "UNKNOWN";
        if (!parsed.categoryAgreement) {
          const aiCat = parsed.aiDetectedCategory;
          if (categoryHint) {
            if (aiCat === categoryHint) {
              parsed.categoryAgreement = "AGREES";
            } else if (aiCat === "UNKNOWN") {
              parsed.categoryAgreement = "INSUFFICIENT_EVIDENCE";
            } else if (categoryHint === "UNKNOWN") {
              parsed.categoryAgreement = "AGREES";
            } else {
              parsed.categoryAgreement = "CONFLICT";
              parsed.categoryConflictReason = `Visual evidence indicates ${aiCat.replace(/_/g, " ").toLowerCase()} rather than ${(categoryLabel || categoryHint).toLowerCase()}.`;
            }
          } else {
            parsed.categoryAgreement = aiCat !== "UNKNOWN" ? "AGREES" : "INSUFFICIENT_EVIDENCE";
          }
        }
        return res.json(parsed);
      } catch (err: any) {
        console.error("Gemini invocation failed:", err.message);
        if (process.env.VITE_DEMO_MODE === "true") {
          console.log("Running in demo mode; falling back to offline analysis.");
          return res.json(fallbackAnalysis());
        } else {
          return res.status(503).json({ error: "GEMINI_API_FAILURE", message: err.message || "Gemini model failed to respond." });
        }
      }
    } else {
      if (process.env.VITE_DEMO_MODE === "true") {
        console.log(`No Gemini API key found or isDemoOnly=${isDemoOnly}. Using deterministic fallback analysis.`);
        return res.json(fallbackAnalysis());
      } else {
        return res.status(503).json({ error: "GEMINI_API_UNCONFIGURED", message: "Gemini API key is missing or unconfigured in Live Pilot Mode." });
      }
    }
  });

  // POST Evaluate Fusion
  app.post("/api/v1/fusion/evaluate", async (req, res) => {
    const { report } = req.body;

    const details: string[] = [];
    if (!report) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REPORT_INPUT",
        details: [
          "VALID_LATITUDE_REQUIRED",
          "VALID_LONGITUDE_REQUIRED",
          "ANALYSIS_REQUIRED",
          "RESOLVED_EVENT_CATEGORY_REQUIRED"
        ]
      });
    }

    const lat = report.latitude;
    const lng = report.longitude;

    const isLatValid = typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90;
    if (!isLatValid) {
      details.push("VALID_LATITUDE_REQUIRED");
    }

    const isLngValid = typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
    if (!isLngValid) {
      details.push("VALID_LONGITUDE_REQUIRED");
    }

    if (!report.analysis) {
      details.push("ANALYSIS_REQUIRED");
    }

    let resolvedEventType = "UNKNOWN";
    if (report.analysis) {
      const confidence = report.analysis.confidence ?? 0;
      const aiCat = report.analysis.aiDetectedCategory;
      const hasHighConfidenceAiCategory = confidence >= 0.75 && aiCat && aiCat !== "UNKNOWN";
      resolvedEventType = hasHighConfidenceAiCategory ? aiCat : (report.categoryHint || report.analysis.eventType || "UNKNOWN");
    }

    if (!resolvedEventType || resolvedEventType === "UNKNOWN") {
      details.push("RESOLVED_EVENT_CATEGORY_REQUIRED");
    }

    if (details.length > 0) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REPORT_INPUT",
        details
      });
    }

    // Save report in local list
    const liveReportId = `live_report_${Date.now()}`;
    const liveReportWithId = {
      ...report,
      id: liveReportId,
      timestamp: new Date().toISOString(),
    };
    liveReports.push(liveReportWithId);

    const isDemoMode = process.env.VITE_DEMO_MODE === "true";

    let correlatedReports: any[] = [];
    let liveReportCount = 1;
    let seededReportCount = 0;
    let totalReportCount = 1;
    let C = 0.0;
    let G = 0.0;
    let T = 0.0;
    let correlationExplanation = "1 live citizen observation analyzed.";

    // Haversine distance helper function
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

    // Resolve downstream eventType
    const confidence = liveReportWithId.analysis?.confidence ?? 0;
    const aiCat = liveReportWithId.analysis?.aiDetectedCategory;
    const hasHighConfidenceAiCategory = confidence >= 0.75 && aiCat && aiCat !== "UNKNOWN";
    resolvedEventType = hasHighConfidenceAiCategory ? aiCat : (liveReportWithId.categoryHint || liveReportWithId.analysis?.eventType || "UNKNOWN");

    console.log(`Resolved eventType for downstream triggering: ${resolvedEventType} (hasHighConfidenceAiCategory: ${hasHighConfidenceAiCategory})`);

    // Perform spatial and temporal calculations
    if (isDemoMode) {
      // In demo mode, calculate flat distance and correlate with seeded report
      const distKm = getHaversineDistanceKm(liveReportWithId.latitude, liveReportWithId.longitude, SEEDED_REPORT.latitude, SEEDED_REPORT.longitude);
      const distanceMeters = distKm * 1000;

      console.log(`Calculating signal fusion between live report and seeded report in DEMO MODE. Distance: ${distanceMeters.toFixed(1)}m`);

      correlatedReports = [liveReportWithId, SEEDED_REPORT];
      liveReportCount = 1;
      seededReportCount = 1;
      totalReportCount = 2;

      // C = citizen correlation based on the number of compatible PRIOR supporting observations.
      // Current report is excluded.
      // Under demo mode, there is 1 compatible prior supporting observation (SEEDED_REPORT)
      C = 0.6;

      // Distance thresholds for G
      if (distanceMeters <= 250) {
        G = 1.0;
      } else if (distanceMeters <= 500) {
        G = 0.8;
      } else if (distanceMeters <= 750) {
        G = 0.6;
      } else if (distanceMeters <= 1000) {
        G = 0.4;
      } else {
        G = 0.0;
      }

      // Fully concurrent in demo mode -> T = 1.0
      T = 1.0;
      correlationExplanation = "1 live citizen observation + 1 demo supporting observation";
    } else {
      // Live Pilot Mode: Correlate against previous live reports in memory
      const nowMs = Date.now();
      const matchedPriorReports = liveReports.filter((r) => {
        if (r.id === liveReportId) return false; // skip current
        
        // 1. Check distance (<= 1 km)
        const distKm = getHaversineDistanceKm(liveReportWithId.latitude, liveReportWithId.longitude, r.latitude, r.longitude);
        if (distKm > 1.0) return false;

        // 2. Check time (<= 60 minutes)
        const rTimeMs = new Date(r.timestamp).getTime();
        const diffMins = Math.abs(nowMs - rTimeMs) / 60000;
        if (diffMins > 60) return false;

        // 3. Check event category compatibility
        const rConfidence = r.analysis?.confidence ?? 0;
        const rAiCat = r.analysis?.aiDetectedCategory;
        const rHasHighConfidence = rConfidence >= 0.75 && rAiCat && rAiCat !== "UNKNOWN";
        const rResolvedType = rHasHighConfidence ? rAiCat : (r.categoryHint || r.analysis?.eventType || "UNKNOWN");

        return categoryCompatibility(resolvedEventType, rResolvedType);
      });

      correlatedReports = [liveReportWithId, ...matchedPriorReports];
      liveReportCount = correlatedReports.length;
      seededReportCount = 0;
      totalReportCount = liveReportCount;

      const n = matchedPriorReports.length;
      C =
        n === 0 ? 0.0 :
        n === 1 ? 0.6 :
        n === 2 ? 0.8 :
        1.0;

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
        if (nearestDistMeters <= 250) {
          G = 1.0;
        } else if (nearestDistMeters <= 500) {
          G = 0.8;
        } else if (nearestDistMeters <= 750) {
          G = 0.6;
        } else if (nearestDistMeters <= 1000) {
          G = 0.4;
        } else {
          G = 0.0;
        }

        const timeDiffMins = Math.abs(nowMs - newestTimeMs) / 60000;
        if (timeDiffMins <= 15) {
          T = 1.0;
        } else if (timeDiffMins <= 30) {
          T = 0.8;
        } else if (timeDiffMins <= 45) {
          T = 0.6;
        } else if (timeDiffMins <= 60) {
          T = 0.4;
        } else {
          T = 0.0;
        }

        correlationExplanation = `${liveReportCount} live citizen observations correlated.`;
      } else {
        G = 0.0;
        T = 0.0;
        correlationExplanation = "1 live citizen observation analyzed (no correlated nearby reports found).";
      }
    }

    // Check for combustion-related incident to retrieve NASA FIRMS thermal context
    const isCombustion = resolvedEventType === "OPEN_WASTE_BURNING" || resolvedEventType === "INDUSTRIAL_SMOKE";
    let thermalContext = undefined;
    let thermalContextScore = undefined;

    if (isCombustion) {
      thermalContext = await FirmsService.getThermalContext(liveReportWithId.latitude, liveReportWithId.longitude);
      
      if (thermalContext.available) {
        if (thermalContext.detectionFound && thermalContext.nearestDetectionDistanceKm !== undefined) {
          const dist = thermalContext.nearestDetectionDistanceKm;
          // Linear score: 1.0 at 0km, 0.0 at 10km
          const distanceScore = Math.max(0.0, Math.min(1.0, (10 - dist) / 10));
          thermalContextScore = parseFloat(distanceScore.toFixed(2));
        } else {
          thermalContextScore = 0.0; // low supporting evidence
        }
      }
    }

    // Retrieve real ground context
    const groundMonitoring = await GroundMonitoringService.getContext(
      liveReportWithId.latitude,
      liveReportWithId.longitude,
      resolvedEventType
    );

    // Retrieve real weather context
    const weatherContext = await WeatherContextService.getContext(
      liveReportWithId.latitude,
      liveReportWithId.longitude
    );

    // HEURISTIC SCORING ENGINE:
    // H = 0.20*C + 0.20*V + 0.25*S + 0.15*G + 0.10*T + 0.10*M
    const V = typeof liveReportWithId.analysis?.confidence === "number" ? liveReportWithId.analysis.confidence : 0.0;
    
    // Set S from real ground context or null if not available
    const S = groundMonitoring.anomalyAvailable && typeof groundMonitoring.anomalyScore === "number"
      ? groundMonitoring.anomalyScore
      : null;
    
    // Set M to weatherContext.persistenceScore or null if unavailable
    const M = (weatherContext && typeof weatherContext.persistenceScore === "number")
      ? weatherContext.persistenceScore
      : null;

    // Use SignalFusionService!
    const fusionBreakdown = SignalFusionService.evaluate({
      citizenCorrelation: C,
      visualEvidenceConfidence: V,
      groundMonitoringAnomaly: S,
      geospatialCorrelation: G,
      temporalCorrelation: T,
      atmosphericPersistence: M,
      ...(thermalContextScore !== undefined ? { thermalContextScore } : {})
    });

    const finalScore = fusionBreakdown.finalScore;

    const DEMO_FORECAST = {
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

    // Implement explicit promotion logic based on the actual classification returned by SignalFusionService
    const promotableClassifications = new Set([
      "PROBABLE HOTSPOT",
      "HIGH-CONFIDENCE SIGNAL"
    ]);

    const isPromoted = promotableClassifications.has(fusionBreakdown.classification);

    let actualHotspot = null;

    if (isPromoted) {
      const hotspotId = `hotspot_pune_01`;
      actualHotspot = {
        id: hotspotId,
        latitude: 18.5221, // Centroid of reports
        longitude: 73.8556,
        eventType: resolvedEventType || "OPEN_WASTE_BURNING",
        severity: liveReportWithId.analysis?.severity || "HIGH",
        confidence: parseFloat((finalScore * 100).toFixed(0)) / 100,
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
          groundMonitoring, // Reuse already resolved groundMonitoring
          satelliteContext: SatelliteContextService.getContext(18.5221, 73.8556),
          weatherContext,
          ...(thermalContext ? { thermalContext } : {}),
        },
        forecast: isDemoMode ? DEMO_FORECAST : {
          available: false,
          disclosure: "FORECASTING NOT AVAILABLE IN LIVE PILOT MODE",
          points: []
        },
        dispatch: isDemoMode ? {
          teamName: "Environmental Response Team 02",
          status: "AVAILABLE",
          etaMinutes: 18,
        } : {
          available: false,
          disclosure: "MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED"
        },
      };

      // Replace or add to hotspots list
      hotspots = [actualHotspot];
    } else {
      // If not promoted, do not place in the hotspot list
      hotspots = [];
    }

    res.json({
      success: true,
      promoted: isPromoted,
      reportId: liveReportId,
      fusion: fusionBreakdown,
      hotspot: actualHotspot,
    });
  });

  // GET Hotspots
  app.get("/api/v1/hotspots", (req, res) => {
    res.json(hotspots);
  });

  // GET Hotspot by ID
  app.get("/api/v1/hotspots/:id", (req, res) => {
    const id = req.params.id;
    const hotspot = hotspots.find((h) => h.id === id);

    if (!hotspot) {
      return res.status(404).json({ error: "Hotspot not found." });
    }

    res.json(hotspot);
  });

  // POST Dispatch Action
  app.post("/api/v1/incidents/:id/dispatch", (req, res) => {
    const isDemoMode = process.env.VITE_DEMO_MODE === "true";
    if (!isDemoMode) {
      return res.status(503).json({
        success: false,
        error: "MUNICIPAL_DISPATCH_NOT_CONNECTED",
        disclosure: "MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED"
      });
    }

    const id = req.params.id;
    const { teamName } = req.body;
    const hotspot = hotspots.find((h) => h.id === id);

    if (!hotspot) {
      return res.status(404).json({ error: "Incident not found." });
    }

    // Update dispatch state to EN_ROUTE
    hotspot.dispatch = {
      teamName: teamName || "Environmental Response Team 02",
      status: "EN_ROUTE",
      etaMinutes: 18,
      timestamp: new Date().toISOString(),
    };

    console.log(`Dispatched team: ${teamName} to Hotspot: ${id}`);
    res.json({ success: true, hotspot });
  });

  // ==========================================
  // VITE OR STATIC FILE SERVING
  // ==========================================

  if (process.env.NODE_ENV !== "production") {
    // Integrate Vite as development server middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve bundled static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to host 0.0.0.0 and port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AEROGRID Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
