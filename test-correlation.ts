import assert from "node:assert";
import { generatePromotionExplanations } from "./src/utils/correlationUtils";
import { Hotspot, EventType, Severity } from "./src/types/api";

console.log("=================================================");
console.log("🏃 STARTING AEROGRID SIGNAL CORRELATION TEST SUITE");
console.log("=================================================");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

const mockBaseHotspot: Hotspot = {
  id: "test-hotspot-1",
  latitude: 18.5204,
  longitude: 73.8567,
  eventType: EventType.OPEN_WASTE_BURNING,
  severity: Severity.HIGH,
  confidence: 0.85,
  address: "Shivajinagar, Pune",
  timestamp: "2026-07-06T20:00:00Z",
  reportsCount: 1,
  citizenReports: [
    {
      id: "report-1",
      timestamp: "2026-07-06T19:55:00Z",
      text: "Trash fire burning in the alley",
      language: "en",
      latitude: 18.5204,
      longitude: 73.8567,
      categoryLabel: "OPEN_WASTE_BURNING",
      selectedCategory: "waste",
      citizenSelectedCategory: "waste",
      categoryAgreement: "AGREES",
      aiDetectedCategory: EventType.OPEN_WASTE_BURNING,
      analysis: {
        eventType: EventType.OPEN_WASTE_BURNING,
        pollutionTypes: ["smoke", "particulate"],
        visualEvidence: { smokeDetected: true, smokeDensity: "HIGH" },
        severity: Severity.HIGH,
        confidence: 0.88,
        summary: "Visual evidence confirm waste burning",
        evidence: ["smoke", "fire"],
        categoryAgreement: "AGREES",
        aiDetectedCategory: EventType.OPEN_WASTE_BURNING,
      }
    }
  ],
  fusion: {
    citizenReportCorrelation: 0.8,
    visualEvidenceConfidence: 0.88,
    groundMonitoringAnomaly: 0.72,
    geospatialCorrelation: 0.9,
    temporalCorrelation: 0.95,
    atmosphericPersistence: 0.78,
    finalScore: 0.81,
    classification: "HIGH-CONFIDENCE SIGNAL"
  },
  context: {
    groundMonitoring: {
      available: true,
      stationName: "Shivajinagar CPCB Station",
      distanceKm: 1.2,
      pollutant: "PM2.5",
      currentValue: 120,
      baseline: 70,
      relativeAnomaly: 0.714,
      anomalyAvailable: true,
      source: "CPCB_GOV"
    },
    weatherContext: {
      available: true,
      dispersionCondition: "LOW",
      persistenceScore: 0.78,
      source: "GOOGLE_WEATHER"
    },
    thermalContext: {
      available: true,
      detectionFound: true,
      nearestDetectionDistanceKm: 1.5,
      acquisitionDate: "2026-07-06",
      acquisitionTime: "1045",
      satellite: "Suomi NPP",
      instrument: "VIIRS",
      confidence: "nominal",
      source: "NASA_FIRMS"
    }
  },
  forecast: {
    points: [],
    predictedSpikeTime: "+3H",
    predictedSpikeValue: 150,
    spikeRisk: 80,
    contributors: []
  }
};

// 1. Verify specific static fallback strings are absent from promotion sentences
test("No static text elements (+420m, Shivajinagar CPCB Station hardcoded fallback) are generated statically if not matching the real record", () => {
  const customHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  customHotspot.context.groundMonitoring.stationName = "Swargate CPCB Station";
  customHotspot.context.groundMonitoring.pollutant = "PM10";
  
  const explanations = generatePromotionExplanations(customHotspot);
  
  // Should have Swargate context, not Shivajinagar fallback
  assert.ok(explanations.includes("Government PM10 context is available from Swargate CPCB Station."));
  assert.ok(!explanations.some(e => e.includes("+420m")));
  assert.ok(!explanations.some(e => e.includes("7m prior")));
  assert.ok(!explanations.some(e => e.includes("+72% PM2.5 Anomaly")));
  assert.ok(!explanations.some(e => e.includes("Low Dispersion (1.8m/s)")));
});

// 2. Real correlation count is displayed when available
test("explanations report count is formatted dynamically from reports list", () => {
  const singleHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  singleHotspot.reportsCount = 1;
  singleHotspot.citizenReports = [mockBaseHotspot.citizenReports[0]];
  
  const singleExplanations = generatePromotionExplanations(singleHotspot);
  assert.ok(singleExplanations.includes("Nearby citizen observations were correlated."));

  const multiHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  multiHotspot.reportsCount = 3;
  multiHotspot.citizenReports = [
    mockBaseHotspot.citizenReports[0],
    mockBaseHotspot.citizenReports[0],
    mockBaseHotspot.citizenReports[0]
  ];
  const multiExplanations = generatePromotionExplanations(multiHotspot);
  assert.ok(multiExplanations.includes("3 nearby citizen observations were correlated."));
});

// 3. FIRMS DETECTION, NO DETECTION, NOT QUERIED, UNAVAILABLE states work
test("NASA FIRMS state explanations work", () => {
  // Detection state
  const detHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  assert.ok(generatePromotionExplanations(detHotspot).includes("NASA FIRMS detected nearby thermal anomaly context."));

  // No Detection state
  const noDetHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  noDetHotspot.context.thermalContext.detectionFound = false;
  assert.ok(generatePromotionExplanations(noDetHotspot).includes("No recent nearby FIRMS thermal anomaly was detected."));

  // Not Queried state (no thermalContext)
  const notQueriedHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  delete notQueriedHotspot.context.thermalContext;
  const explanations = generatePromotionExplanations(notQueriedHotspot);
  assert.ok(!explanations.some(e => e.includes("FIRMS")));

  // Unavailable state
  const unavailHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  unavailHotspot.context.thermalContext.available = false;
  const unavailExplanations = generatePromotionExplanations(unavailHotspot);
  assert.ok(!unavailExplanations.some(e => e.includes("FIRMS")));
});

// 4. AQ anomaly is shown only when anomalyAvailable === true
test("Government AQ anomaly is present only when anomalyAvailable is true", () => {
  const activeAnomalyHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  activeAnomalyHotspot.context.groundMonitoring.anomalyAvailable = true;
  assert.ok(generatePromotionExplanations(activeAnomalyHotspot).includes("Government AQ anomaly context is available."));

  const inactiveAnomalyHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  inactiveAnomalyHotspot.context.groundMonitoring.anomalyAvailable = false;
  assert.ok(!generatePromotionExplanations(inactiveAnomalyHotspot).includes("Government AQ anomaly context is available."));
});

// 5. Category AGREES and CONFLICT explanations work
test("AI category agreement and conflict explanations behave correctly", () => {
  // GEMINI_MULTIMODAL + AGREEMENT
  const geminiAgreesHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  geminiAgreesHotspot.citizenReports[0].analysis.analysisSource = "GEMINI_MULTIMODAL";
  geminiAgreesHotspot.citizenReports[0].categoryAgreement = "AGREES";
  const gAgreesResult = generatePromotionExplanations(geminiAgreesHotspot);
  assert.ok(gAgreesResult.some(e => e.includes("Gemini evidence agrees with the citizen-selected incident category.")), "Gemini agrees explanation mismatch");
  assert.ok(gAgreesResult.some(e => e.includes("Gemini")), "Should contain 'Gemini'");

  // GEMINI_MULTIMODAL + CONFLICT
  const geminiConflictHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  geminiConflictHotspot.citizenReports[0].analysis.analysisSource = "GEMINI_MULTIMODAL";
  geminiConflictHotspot.citizenReports[0].categoryAgreement = "CONFLICT";
  geminiConflictHotspot.citizenReports[0].aiDetectedCategory = EventType.DUST_EMISSION;
  const gConflictResult = generatePromotionExplanations(geminiConflictHotspot);
  assert.ok(gConflictResult.some(e => e.includes("Gemini evidence conflicts with the citizen-selected category and identified DUST_EMISSION.")), "Gemini conflict explanation mismatch");
  assert.ok(gConflictResult.some(e => e.includes("Gemini")), "Should contain 'Gemini'");

  // DEMO_FALLBACK + AGREEMENT
  const fallbackAgreesHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  fallbackAgreesHotspot.citizenReports[0].analysis.analysisSource = "DEMO_FALLBACK";
  fallbackAgreesHotspot.citizenReports[0].categoryAgreement = "AGREES";
  const fAgreesResult = generatePromotionExplanations(fallbackAgreesHotspot);
  assert.ok(fAgreesResult.some(e => e.includes("Evidence analysis agrees with the citizen-selected category.")), "Fallback agrees explanation mismatch");
  assert.ok(!fAgreesResult.some(e => e.includes("Gemini")), "Non-Gemini source must not contain 'Gemini'");

  // DEMO_FALLBACK + CONFLICT
  const fallbackConflictHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  fallbackConflictHotspot.citizenReports[0].analysis.analysisSource = "DEMO_FALLBACK";
  fallbackConflictHotspot.citizenReports[0].categoryAgreement = "CONFLICT";
  fallbackConflictHotspot.citizenReports[0].aiDetectedCategory = EventType.DUST_EMISSION;
  const fConflictResult = generatePromotionExplanations(fallbackConflictHotspot);
  assert.ok(fConflictResult.some(e => e.includes("Evidence analysis indicates a category conflict and identified DUST_EMISSION.")), "Fallback conflict explanation mismatch");
  assert.ok(!fConflictResult.some(e => e.includes("Gemini")), "Non-Gemini source must not contain 'Gemini'");

  // missing analysisSource + AGREEMENT
  const missingAgreesHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  delete missingAgreesHotspot.citizenReports[0].analysis.analysisSource;
  missingAgreesHotspot.citizenReports[0].categoryAgreement = "AGREES";
  const mAgreesResult = generatePromotionExplanations(missingAgreesHotspot);
  assert.ok(mAgreesResult.some(e => e.includes("Evidence analysis agrees with the citizen-selected category.")), "Missing agrees explanation mismatch");
  assert.ok(!mAgreesResult.some(e => e.includes("Gemini")), "Missing source must not contain 'Gemini'");

  // missing analysisSource + CONFLICT
  const missingConflictHotspot = JSON.parse(JSON.stringify(mockBaseHotspot));
  delete missingConflictHotspot.citizenReports[0].analysis.analysisSource;
  missingConflictHotspot.citizenReports[0].categoryAgreement = "CONFLICT";
  missingConflictHotspot.citizenReports[0].aiDetectedCategory = EventType.DUST_EMISSION;
  const mConflictResult = generatePromotionExplanations(missingConflictHotspot);
  assert.ok(mConflictResult.some(e => e.includes("Evidence analysis indicates a category conflict and identified DUST_EMISSION.")), "Missing conflict explanation mismatch");
  assert.ok(!mConflictResult.some(e => e.includes("Gemini")), "Missing source must not contain 'Gemini'");
});

console.log("-------------------------------------------------");
console.log("📊 SIGNAL CORRELATION TEST SUITE SUMMARY: ALL PASSED");
console.log("-------------------------------------------------");
