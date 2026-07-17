import { 
  CitizenReport, 
  EnvironmentalContext, 
  GeminiAnalysisResult, 
  Hotspot,
  EventType,
  Severity
} from "../types/api";
import { FUSION_CONFIG } from "../config/fusionConfig";

const BASE_URL = (typeof import.meta !== "undefined" && import.meta.env) ? (import.meta.env.VITE_API_BASE_URL || "") : "";

export const isDemoMode = (typeof import.meta !== "undefined" && import.meta.env) ? (import.meta.env.VITE_DEMO_MODE === "true") : false;

// ==========================================================
// CLIENT-SIDE LOCAL STORAGE FALLBACK ENGINE
// ==========================================================
const FALLBACK_KEY_REPORTS = "aerogrid_fallback_reports";
const FALLBACK_KEY_HOTSPOTS = "aerogrid_fallback_hotspots";

const SEEDED_REPORT_ID = "prototype_report_02";
const SEEDED_REPORT: CitizenReport = {
  id: SEEDED_REPORT_ID,
  timestamp: new Date(Date.now() - 9 * 60000).toISOString(),
  text: "High level of waste burning spotted near the market area. Huge plumes of plastic smoke.",
  language: "mr",
  latitude: 18.5238,
  longitude: 73.8545,
  isSeeded: true,
  imageUrl: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?auto=format&fit=crop&q=80&w=500",
  analysis: {
    eventType: EventType.OPEN_WASTE_BURNING,
    pollutionTypes: ["SMOKE", "TOXIC_GAS"],
    visualEvidence: {
      smokeDetected: true,
      smokeDensity: "HIGH",
    },
    severity: Severity.HIGH,
    confidence: 0.91,
    summary: "Dense black smoke with visible ground debris is highly consistent with unmanaged municipal waste combustion.",
    evidence: [
      "Dense grey/black smoke columns visible in photo",
      "Debris fire signature in close proximity to residential margins",
    ],
    analysisSource: "GEMINI_MULTIMODAL",
  },
};

function getLocalReports(): CitizenReport[] {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY_REPORTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalReports(reports: CitizenReport[]) {
  try {
    localStorage.setItem(FALLBACK_KEY_REPORTS, JSON.stringify(reports));
  } catch (err) {
    console.error("Local storage write failed", err);
  }
}

function getLocalHotspots(): Hotspot[] {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY_HOTSPOTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalHotspots(hotspots: Hotspot[]) {
  try {
    localStorage.setItem(FALLBACK_KEY_HOTSPOTS, JSON.stringify(hotspots));
  } catch (err) {
    console.error("Local storage write failed", err);
  }
}

function fallbackGetEnvironmentalContext(latitude: number, longitude: number, eventType?: string): EnvironmentalContext {
  const isCombustion = eventType === "OPEN_WASTE_BURNING" || eventType === "INDUSTRIAL_SMOKE";
  
  const thermalContext = isCombustion ? {
    available: true,
    detectionFound: true,
    nearestDetectionDistanceKm: 1.8,
    detectionLatitude: 18.5235,
    detectionLongitude: 73.8540,
    acquisitionDate: new Date().toISOString().split("T")[0],
    acquisitionTime: "1045",
    satellite: "Suomi NPP",
    instrument: "VIIRS",
    confidence: "nominal",
    brightness: 332.4,
    fireRadiativePower: 7.2,
    dayNight: "D",
    source: "PROTOTYPE_THERMAL_CONTEXT",
    isPrototype: true
  } : undefined;

  return {
    groundMonitoring: {
      available: true,
      stationName: "Shivajinagar CPCB Station",
      distanceKm: 3.2,
      pollutant: "PM2.5",
      currentValue: 117,
      baseline: 68,
      relativeAnomaly: 0.72,
      anomalyScore: 0.72,
      anomalyAvailable: true,
      timestamp: new Date().toISOString(),
      source: "PROTOTYPE_GROUND_CONTEXT",
      isPrototype: true,
    },
    satelliteContext: {
      available: false,
    },
    weatherContext: {
      available: true,
      temperatureC: 27,
      relativeHumidity: 68,
      windSpeedKph: 6.48, // 1.8 m/s
      windSpeed: 1.8,
      windDirectionDegrees: 240,
      precipitationMm: 0,
      weatherCondition: "Overcast",
      dispersionCondition: "LOW",
      persistenceScore: 0.78,
      timestamp: new Date().toISOString(),
      source: "PROTOTYPE_WEATHER_CONTEXT",
      isPrototype: true
    },
    ...(thermalContext ? { thermalContext } : {})
  };
}

function fallbackAnalyzeCitizenReport(
  text: string, 
  image: string | null, 
  language: "en" | "hi" | "mr",
  selectedCategory?: string,
  categoryHint?: string,
  categoryLabel?: string
): GeminiAnalysisResult {
  const lowerText = (text || "").toLowerCase();
  let eventType = EventType.UNKNOWN;
  let summary = "Local pollution observation submitted.";
  let evidence = ["Citizen submitted report."];
  let severity = Severity.MODERATE;
  let confidence = 0.75;
  let smokeDetected = false;
  let smokeDensity: "LOW" | "MODERATE" | "HIGH" | "NONE" = "NONE";

  if (lowerText.includes("कचरा") || lowerText.includes("कचरा जाळत") || lowerText.includes("waste") || lowerText.includes("burn") || lowerText.includes("burning")) {
    eventType = EventType.OPEN_WASTE_BURNING;
    severity = Severity.HIGH;
    confidence = 0.89;
    smokeDetected = true;
    smokeDensity = "HIGH";
    summary = "Dense visible smoke is consistent with possible open waste burning.";
    evidence = [
      "Citizen reports waste burning and heavy smoke.",
      "Image/context supports unmanaged open combustion signals."
    ];
  } else if (lowerText.includes("dust") || lowerText.includes("धूळ") || lowerText.includes("construction") || lowerText.includes("काम")) {
    eventType = EventType.CONSTRUCTION_DUST;
    severity = Severity.HIGH;
    confidence = 0.82;
    smokeDetected = false;
    summary = "Suspended particulate cloud consistent with construction activities.";
    evidence = [
      "Citizen reported construction dust emissions.",
      "Visual analysis indicates coarse dust layers."
    ];
  } else if (lowerText.includes("traffic") || lowerText.includes("गाड्या") || lowerText.includes("smog") || lowerText.includes("धूर")) {
    eventType = EventType.TRAFFIC_SMOG;
    severity = Severity.MODERATE;
    confidence = 0.80;
    smokeDetected = true;
    smokeDensity = "MODERATE";
    summary = "Accumulated vehicular smog in low-dispersion wind window.";
    evidence = [
      "Heavy morning traffic reports.",
      "Visual haze layer observed."
    ];
  } else if (lowerText.includes("smoke") || lowerText.includes("धूर")) {
    eventType = EventType.INDUSTRIAL_SMOKE;
    severity = Severity.HIGH;
    confidence = 0.85;
    smokeDetected = true;
    smokeDensity = "HIGH";
    summary = "Thick chimney or stack exhaust consistent with industrial emissions.";
    evidence = [
      "Citizen reports heavy localized stack smoke.",
      "Plume dispersion indicates high emissions flow."
    ];
  } else if (categoryHint && categoryHint !== "UNKNOWN") {
    eventType = categoryHint as EventType;
    if (eventType === "SMOKE") {
      summary = "Dense or unusual smoke visible nearby.";
      evidence = ["Citizen reported dense smoke."];
      severity = Severity.MODERATE;
      confidence = 0.80;
      smokeDetected = true;
      smokeDensity = "HIGH";
    } else if (eventType === "UNUSUAL_AIR") {
      summary = "Strong chemical, burning, or unusual smell detected.";
      evidence = ["Citizen reported bad smell / unusual air quality."];
      severity = Severity.MODERATE;
      confidence = 0.75;
      smokeDetected = false;
      smokeDensity = "NONE";
    } else if (eventType === "OPEN_WASTE_BURNING") {
      severity = Severity.HIGH;
      confidence = 0.89;
      smokeDetected = true;
      smokeDensity = "HIGH";
      summary = "Dense visible smoke is consistent with possible open waste burning.";
      evidence = [
        "Citizen reports waste burning and heavy smoke.",
        "Image/context supports unmanaged open combustion signals."
      ];
    } else if (eventType === "CONSTRUCTION_DUST") {
      severity = Severity.HIGH;
      confidence = 0.82;
      smokeDetected = false;
      summary = "Suspended particulate cloud consistent with construction activities.";
      evidence = [
        "Citizen reported construction dust emissions.",
        "Visual analysis indicates coarse dust layers."
      ];
    } else if (eventType === "TRAFFIC_SMOG") {
      severity = Severity.MODERATE;
      confidence = 0.80;
      smokeDetected = true;
      smokeDensity = "MODERATE";
      summary = "Accumulated vehicular smog in low-dispersion wind window.";
      evidence = [
        "Heavy morning traffic reports.",
        "Visual haze layer observed."
      ];
    } else if (eventType === "DUST_EMISSION") {
      severity = Severity.MODERATE;
      confidence = 0.78;
      smokeDetected = false;
      summary = "Suspended road dust cloud consistent with heavy traffic on dusty roads.";
      evidence = ["Citizen reports heavy road dust."];
    }
  }

  let aiDetectedCategory = eventType;
  let citizenSelectedCategory = selectedCategory || "";
  let categoryAgreement: "AGREES" | "CONFLICT" | "INSUFFICIENT_EVIDENCE" = "INSUFFICIENT_EVIDENCE";
  let categoryConflictReason: string | null = null;

  if (categoryHint) {
    if (aiDetectedCategory === EventType.UNKNOWN || categoryHint === "UNKNOWN") {
      categoryAgreement = "INSUFFICIENT_EVIDENCE";
    } else if (aiDetectedCategory === categoryHint) {
      categoryAgreement = "AGREES";
    } else {
      categoryAgreement = "CONFLICT";
      categoryConflictReason = `Visual evidence indicates ${aiDetectedCategory.replace(/_/g, " ").toLowerCase()} rather than ${(categoryLabel || categoryHint).toLowerCase()}.`;
    }
  } else {
    categoryAgreement = aiDetectedCategory !== EventType.UNKNOWN ? "AGREES" : "INSUFFICIENT_EVIDENCE";
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
    analysisSource: "DEMO_FALLBACK",
    selectedCategory,
    categoryHint,
    categoryLabel,
    categoryAgreement,
    citizenSelectedCategory,
    aiDetectedCategory,
    categoryConflictReason
  };
}

function fallbackEvaluateFusion(report: Partial<CitizenReport>): {
  success: boolean;
  promoted: boolean;
  reportId: string;
  fusion: any;
  hotspot: Hotspot | null;
} {
  const liveReportId = `live_report_${Date.now()}`;
  const liveReportWithId: CitizenReport = {
    id: liveReportId,
    timestamp: new Date().toISOString(),
    text: report.text || "",
    language: report.language || "en",
    latitude: report.latitude || 18.5204,
    longitude: report.longitude || 73.8567,
    imageUrl: report.imageUrl,
    analysis: report.analysis,
  };

  const reports = getLocalReports();
  reports.push(liveReportWithId);
  saveLocalReports(reports);

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
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

  const resolvedEventType = liveReportWithId.analysis?.eventType || "UNKNOWN";

  let matchedPriorReports: CitizenReport[] = [];
  if (isDemoMode) {
    const rResolvedType = SEEDED_REPORT.analysis?.eventType || "UNKNOWN";
    if (categoryCompatibility(resolvedEventType, rResolvedType)) {
      matchedPriorReports = [SEEDED_REPORT];
    }
  } else {
    const nowMs = Date.now();
    matchedPriorReports = reports.filter((r) => {
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
  }

  const n = matchedPriorReports.length;
  const C = n === 0 ? 0.0 : n === 1 ? 0.6 : n === 2 ? 0.8 : 1.0;

  let G = 0.0;
  if (isDemoMode) {
    const distKm = getHaversineDistanceKm(liveReportWithId.latitude, liveReportWithId.longitude, SEEDED_REPORT.latitude, SEEDED_REPORT.longitude);
    const distanceMeters = distKm * 1000;
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
  } else {
    if (matchedPriorReports.length > 0) {
      let nearestDistKm = Infinity;
      for (const r of matchedPriorReports) {
        const d = getHaversineDistanceKm(liveReportWithId.latitude, liveReportWithId.longitude, r.latitude, r.longitude);
        if (d < nearestDistKm) nearestDistKm = d;
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
    }
  }

  let T = 0.0;
  if (isDemoMode) {
    T = 1.0;
  } else {
    if (matchedPriorReports.length > 0) {
      let newestTimeMs = 0;
      for (const r of matchedPriorReports) {
        const rTimeMs = new Date(r.timestamp).getTime();
        if (rTimeMs > newestTimeMs) newestTimeMs = rTimeMs;
      }
      const nowMs = Date.now();
      const diffMins = Math.abs(nowMs - newestTimeMs) / 60000;
      if (diffMins <= 15) {
        T = 1.0;
      } else if (diffMins <= 30) {
        T = 0.8;
      } else if (diffMins <= 45) {
        T = 0.6;
      } else if (diffMins <= 60) {
        T = 0.4;
      } else {
        T = 0.0;
      }
    }
  }

  const context = fallbackGetEnvironmentalContext(18.5221, 73.8556, liveReportWithId.analysis?.eventType);
  const groundMonitoring = context?.groundMonitoring;

  const V = typeof liveReportWithId.analysis?.confidence === "number" ? liveReportWithId.analysis.confidence : 0.0;
  
  // S must be treated as unavailable unless a real resolved GroundMonitoring object explicitly provides:
  // anomalyAvailable === true and typeof anomalyScore === "number"
  const isRealGroundMonitoring = groundMonitoring && !groundMonitoring.isPrototype && groundMonitoring.source !== "PROTOTYPE_GROUND_CONTEXT";
  const S = (isRealGroundMonitoring && groundMonitoring.anomalyAvailable === true && typeof groundMonitoring.anomalyScore === "number")
    ? groundMonitoring.anomalyScore
    : null;

  const M = (context?.weatherContext && typeof context.weatherContext.persistenceScore === "number")
    ? context.weatherContext.persistenceScore
    : null;

  const w = FUSION_CONFIG.fusionWeights;
  const dimensions = [
    { name: "citizenReportCorrelation", value: C, weight: w.citizenReportCorrelation, label: "Citizen Report Correlation" },
    { name: "visualEvidenceConfidence", value: V, weight: w.visualEvidenceConfidence, label: "Visual Evidence Confidence" },
    { name: "groundMonitoringAnomaly", value: S, weight: w.groundMonitoringAnomaly, label: "Ground Monitoring Anomaly" },
    { name: "geospatialCorrelation", value: G, weight: w.geospatialCorrelation, label: "Geospatial Correlation" },
    { name: "temporalCorrelation", value: T, weight: w.temporalCorrelation, label: "Temporal Correlation" },
    { name: "atmosphericPersistence", value: M, weight: w.atmosphericPersistence, label: "Atmospheric Persistence" }
  ];

  const availableDims = dimensions.filter(d => d.value !== null && d.value !== undefined);
  const unavailableDims = dimensions.filter(d => d.value === null || d.value === undefined);

  let weightedSum = 0;
  let weightTotal = 0;

  for (const d of availableDims) {
    weightedSum += (d.value as number) * d.weight;
    weightTotal += d.weight;
  }

  const finalScore = weightTotal > 0 ? parseFloat((weightedSum / weightTotal).toFixed(2)) : 0;

  let classification: "OBSERVATION" | "WATCH" | "PROBABLE HOTSPOT" | "HIGH-CONFIDENCE SIGNAL" = "OBSERVATION";
  if (finalScore > FUSION_CONFIG.classificationThresholds.highConfidenceSignal) {
    classification = "HIGH-CONFIDENCE SIGNAL";
  } else if (finalScore > FUSION_CONFIG.classificationThresholds.probableHotspot) {
    classification = "PROBABLE HOTSPOT";
  } else if (finalScore > FUSION_CONFIG.classificationThresholds.watch) {
    classification = "WATCH";
  }

  const fusionBreakdown = {
    citizenReportCorrelation: C,
    visualEvidenceConfidence: V,
    groundMonitoringAnomaly: S,
    geospatialCorrelation: G,
    temporalCorrelation: T,
    atmosphericPersistence: M,
    finalScore,
    classification,
    availableEvidenceDimensions: availableDims.map(d => d.label),
    unavailableEvidenceDimensions: unavailableDims.map(d => d.label),
  };

  const promotableClassifications = new Set([
    "PROBABLE HOTSPOT",
    "HIGH-CONFIDENCE SIGNAL"
  ]);

  const isPromoted = promotableClassifications.has(classification);

  let actualHotspot: Hotspot | null = null;

  if (isPromoted) {
    const hotspotId = "hotspot_pune_01";
    actualHotspot = {
      id: hotspotId,
      latitude: 18.5221,
      longitude: 73.8556,
      eventType: liveReportWithId.analysis?.eventType || EventType.OPEN_WASTE_BURNING,
      severity: liveReportWithId.analysis?.severity || Severity.HIGH,
      signalStrength: finalScore,
      address: "Pune Central Pilot Zone (Centroid near Shivajinagar Market)",
      timestamp: new Date().toISOString(),
      reportsCount: n + 1,
      citizenReports: [liveReportWithId, ...matchedPriorReports],
      fusion: fusionBreakdown,
      context,
      forecast: isDemoMode ? {
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
          ...(S !== null ? ["Ground pollutant anomaly (Shivajinagar anomaly spike)"] : []),
          "Low wind dispersion (current speed 1.8 m/s)",
          "Persistent local smoke observations (multiple correlated reports)",
          "High environmental signal confidence index",
        ],
      } : {
        available: false,
        disclosure: "FORECASTING NOT AVAILABLE IN LIVE PILOT MODE",
        points: []
      },
      dispatch: isDemoMode ? {
        teamName: "Environmental Response Team 02",
        status: "AVAILABLE" as any,
        etaMinutes: 18,
        slaTargetMinutes: 45,
      } : {
        available: false,
        disclosure: "MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED"
      },
    };

    saveLocalHotspots([actualHotspot]);
  } else {
    saveLocalHotspots([]);
  }

  return {
    success: true,
    promoted: isPromoted,
    reportId: liveReportId,
    fusion: fusionBreakdown,
    hotspot: actualHotspot,
  };
}

// Helper to handle and validate JSON responses cleanly
async function handleResponse(res: Response) {
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error("HTML response received instead of JSON (session redirect in progress)");
  }
  return res.json();
}

/**
 * Server-side multilingual transcription via Cloud Speech-to-Text.
 * Returns { success, transcript }. On any failure the caller should fall back to the
 * browser's Web Speech API. `audioBase64` is WEBM_OPUS recorded from the mic.
 */
export async function transcribeAudio(audioBase64: string, language: "en" | "hi" | "mr"): Promise<{ success: boolean; transcript?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/speech-to-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64, language }),
    });
    const data = await res.json();
    if (data.success && data.transcript) {
      return { success: true, transcript: data.transcript };
    }
    return { success: false, error: data.error || "SPEECH_TO_TEXT_UNAVAILABLE" };
  } catch (err: any) {
    return { success: false, error: err?.message || "SPEECH_TO_TEXT_UNAVAILABLE" };
  }
}

// ==========================================================
// CORE EXPORTS WITH SMART SELF-HEALING FALLBACKS
// ==========================================================

// GET Environmental Context for Coordinates
export async function getEnvironmentalContext(latitude: number, longitude: number, eventType?: string): Promise<EnvironmentalContext> {
  const isLatValid = typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
  const isLngValid = typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  if (!isLatValid || !isLngValid) {
    throw new Error(`Invalid coordinates for getEnvironmentalContext: latitude=${latitude}, longitude=${longitude}`);
  }
  if (isDemoMode) {
    return fallbackGetEnvironmentalContext(latitude, longitude, eventType);
  }
  try {
    const url = eventType
      ? `${BASE_URL}/api/v1/environment/context?latitude=${latitude}&longitude=${longitude}&eventType=${eventType}`
      : `${BASE_URL}/api/v1/environment/context?latitude=${latitude}&longitude=${longitude}`;
    const res = await fetch(url);
    return await handleResponse(res);
  } catch (err) {
    console.warn("getEnvironmentalContext failed in live pilot mode.", err);
    throw err;
  }
}

// POST Analyze Citizen Report (multimodal)
export async function analyzeCitizenReport(
  text: string, 
  image: string | null, 
  language: "en" | "hi" | "mr",
  selectedCategory?: string,
  categoryHint?: string,
  categoryLabel?: string
): Promise<GeminiAnalysisResult> {
  if (isDemoMode) {
    return fallbackAnalyzeCitizenReport(text, image, language, selectedCategory, categoryHint, categoryLabel);
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/reports/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, image, language, selectedCategory, categoryHint, categoryLabel }),
    });
    return await handleResponse(res);
  } catch (err) {
    console.warn("analyzeCitizenReport failed in live pilot mode.", err);
    throw err;
  }
}

// POST Evaluate Fusion
export async function evaluateFusion(report: Partial<CitizenReport>): Promise<{
  success: boolean;
  reportId: string;
  fusion: any;
  hotspot: Hotspot;
}> {
  if (isDemoMode) {
    return fallbackEvaluateFusion(report);
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/fusion/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ report }),
    });
    return await handleResponse(res);
  } catch (err) {
    console.warn("evaluateFusion failed in live pilot mode.", err);
    throw err;
  }
}

// GET Hotspots
export async function getHotspots(): Promise<Hotspot[]> {
  if (isDemoMode) {
    return getLocalHotspots();
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/hotspots`);
    return await handleResponse(res);
  } catch (err) {
    console.warn("getHotspots failed in live pilot mode.", err);
    throw err;
  }
}

// GET Hotspot by ID
export async function getHotspotById(id: string): Promise<Hotspot> {
  if (isDemoMode) {
    const hotspot = getLocalHotspots().find(h => h.id === id);
    if (!hotspot) {
      throw new Error(`Hotspot ${id} not found in local simulation.`);
    }
    return hotspot;
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/hotspots/${id}`);
    return await handleResponse(res);
  } catch (err) {
    console.warn(`getHotspotById for ${id} failed in live pilot mode.`, err);
    throw err;
  }
}

// POST Dispatch Team
export async function dispatchIncidentResponse(id: string, teamName: string): Promise<{
  success: boolean;
  hotspot: Hotspot;
}> {
  if (isDemoMode) {
    const hotspots = getLocalHotspots();
    const hotspotIndex = hotspots.findIndex(h => h.id === id);
    if (hotspotIndex === -1) {
      throw new Error(`Hotspot ${id} not found in local simulation.`);
    }
    const dispatchedAt = new Date().toISOString();
    const updatedHotspot = {
      ...hotspots[hotspotIndex],
      dispatch: {
        teamName: teamName || "Environmental Response Team 02",
        status: "EN_ROUTE" as any,
        etaMinutes: 18,
        timestamp: dispatchedAt,
        acknowledgedAt: hotspots[hotspotIndex].dispatch?.acknowledgedAt || dispatchedAt,
        dispatchedAt,
      }
    };
    hotspots[hotspotIndex] = updatedHotspot;
    saveLocalHotspots(hotspots);
    return { success: true, hotspot: updatedHotspot };
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/incidents/${id}/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ teamName }),
    });
    return await handleResponse(res);
  } catch (err) {
    console.warn(`dispatchIncidentResponse failed for ${id} in live pilot mode.`, err);
    throw err;
  }
}

// POST Acknowledge incident (starts SLA clock)
export async function acknowledgeIncident(id: string): Promise<{
  success: boolean;
  hotspot: Hotspot;
}> {
  if (isDemoMode) {
    const hotspots = getLocalHotspots();
    const hotspotIndex = hotspots.findIndex(h => h.id === id);
    if (hotspotIndex === -1) {
      throw new Error(`Hotspot ${id} not found in local simulation.`);
    }
    const acknowledgedAt = new Date().toISOString();
    const prev = hotspots[hotspotIndex].dispatch;
    const updatedHotspot = {
      ...hotspots[hotspotIndex],
      dispatch: {
        ...(prev || {}),
        status: (prev && prev.status && prev.status !== "AVAILABLE" ? prev.status : "ACKNOWLEDGED") as any,
        acknowledgedAt,
      }
    };
    hotspots[hotspotIndex] = updatedHotspot;
    saveLocalHotspots(hotspots);
    return { success: true, hotspot: updatedHotspot };
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/incidents/${id}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return await handleResponse(res);
  } catch (err) {
    console.warn(`acknowledgeIncident failed for ${id} in live pilot mode.`, err);
    throw err;
  }
}

// POST Resolve incident (stops SLA clock)
export async function resolveIncident(id: string, outcome?: string): Promise<{
  success: boolean;
  hotspot: Hotspot;
}> {
  if (isDemoMode) {
    const hotspots = getLocalHotspots();
    const hotspotIndex = hotspots.findIndex(h => h.id === id);
    if (hotspotIndex === -1) {
      throw new Error(`Hotspot ${id} not found in local simulation.`);
    }
    const resolvedAt = new Date().toISOString();
    const updatedHotspot = {
      ...hotspots[hotspotIndex],
      dispatch: {
        ...(hotspots[hotspotIndex].dispatch || {}),
        status: "RESOLVED" as any,
        resolvedAt,
        outcome: outcome || "RESOLVED_BY_FIELD_TEAM",
      }
    };
    hotspots[hotspotIndex] = updatedHotspot;
    saveLocalHotspots(hotspots);
    return { success: true, hotspot: updatedHotspot };
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/incidents/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    return await handleResponse(res);
  } catch (err) {
    console.warn(`resolveIncident failed for ${id} in live pilot mode.`, err);
    throw err;
  }
}

// POST Dismiss incident as false positive (human-in-loop)
export async function dismissIncident(id: string, reason?: string): Promise<{
  success: boolean;
  message: string;
  hotspotId: string;
}> {
  if (isDemoMode) {
    const hotspots = getLocalHotspots();
    const remaining = hotspots.filter(h => h.id !== id);
    saveLocalHotspots(remaining);
    return { success: true, message: "Signal dismissed as false positive.", hotspotId: id };
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/incidents/${id}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    return await handleResponse(res);
  } catch (err) {
    console.warn(`dismissIncident failed for ${id} in live pilot mode.`, err);
    throw err;
  }
}

// Subscribe to the live signal stream (Server-Sent Events).
// Returns an unsubscribe function. Falls back to no-op in pure localStorage demo.
export function subscribeSignalStream(
  onEvent: (event: any) => void
): () => void {
  if (isDemoMode && typeof window !== "undefined" && !window.EventSource) {
    return () => {};
  }
  try {
    const es = new EventSource(`${BASE_URL}/api/v1/stream`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent(data);
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do.
    };
    return () => es.close();
  } catch {
    return () => {};
  }
}

// POST Reset Demo
export async function resetDemo(): Promise<{ success: boolean; message: string }> {
  if (isDemoMode) {
    localStorage.removeItem(FALLBACK_KEY_REPORTS);
    localStorage.removeItem(FALLBACK_KEY_HOTSPOTS);
    return { success: true, message: "Local simulation state reset successfully." };
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/demo/reset`, {
      method: "POST",
    });
    return await handleResponse(res);
  } catch (err) {
    console.warn("resetDemo failed in live pilot mode.", err);
    throw err;
  }
}
