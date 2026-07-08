import assert from "node:assert";
import fs from "node:fs";
import { FirmsService } from "./services/firmsService";
import { SignalFusionService } from "./services/signalFusionService";
import { GroundMonitoringService } from "./services/groundMonitoringService";
import { EventType } from "./src/types/api";

console.log("=================================================");
console.log("🏃 STARTING AEROGRID NASA FIRMS SERVICE TEST SUITE");
console.log("=================================================");

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Haversine distance calculation
  test("Haversine Distance calculation accuracy", () => {
    // Distance between Pune Centroid (18.5204, 73.8567) and Shivajinagar (18.5238, 73.8545)
    // Roughly ~0.44 km
    const dist = FirmsService.getHaversineDistanceKm(18.5204, 73.8567, 18.5238, 73.8545);
    assert.ok(dist > 0.4 && dist < 0.5, `Expected distance around 0.44 km, got ${dist.toFixed(3)} km`);
    
    // Distance to same point should be zero
    const selfDist = FirmsService.getHaversineDistanceKm(18.5204, 73.8567, 18.5204, 73.8567);
    assert.strictEqual(selfDist, 0, "Distance to self should be 0");
  });

  // 2. FIRMS CSV parsing logic
  test("FIRMS CSV Parsing into object arrays", () => {
    const csvContent = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
18.5235,73.8540,332.4,0.4,0.4,2026-07-05,1045,N,VIIRS,n,1.0HS,293.2,7.2,D`;

    const results = FirmsService.parseCSV(csvContent);
    assert.strictEqual(results.length, 1, "Should parse exactly 1 record");
    assert.strictEqual(results[0].latitude, "18.5235");
    assert.strictEqual(results[0].longitude, "73.8540");
    assert.strictEqual(results[0].bright_ti4, "332.4");
    assert.strictEqual(results[0].confidence, "n");
    assert.strictEqual(results[0].frp, "7.2");
  });

  // 3. Behavior on empty/malformed responses, missing API key, or API timeout
  test("Graceful prototype fallback when FIRMS_MAP_KEY is missing", async () => {
    const originalKey = process.env.FIRMS_MAP_KEY;
    delete process.env.FIRMS_MAP_KEY;

    try {
      const context = await FirmsService.getThermalContext(18.5221, 73.8556);
      assert.strictEqual(context.available, true, "Should be available via prototype fallback");
      assert.strictEqual(context.isPrototype, true, "Should flag as prototype context");
      assert.strictEqual(context.detectionFound, true, "Should find deterministic mock anomaly");
    } finally {
      process.env.FIRMS_MAP_KEY = originalKey;
    }
  });

  test("Graceful error fallback when API throws or responds with error status", async () => {
    const originalKey = process.env.FIRMS_MAP_KEY;
    process.env.FIRMS_MAP_KEY = "test_fake_key";

    // Backup original fetch
    const originalFetch = global.fetch;

    try {
      // Mock global fetch to return 500 server error
      global.fetch = async () => {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => "Internal Server Error"
        } as any;
      };

      const context = await FirmsService.getThermalContext(18.5221, 73.8556);
      assert.strictEqual(context.available, false, "Should set available to false on fetch status failure");
      assert.strictEqual(context.isPrototype, false, "Should not report prototype context when real key was attempted");
      assert.strictEqual(context.error, "THERMAL_CONTEXT_UNAVAILABLE", "Should return standard unavailable code");
    } finally {
      global.fetch = originalFetch;
      process.env.FIRMS_MAP_KEY = originalKey;
    }
  });

  test("Graceful fallback when fetch request times out/aborts", async () => {
    const originalKey = process.env.FIRMS_MAP_KEY;
    process.env.FIRMS_MAP_KEY = "test_fake_key";
    const originalFetch = global.fetch;

    try {
      // Mock fetch to reject with AbortError simulating timeout
      global.fetch = async () => {
        throw new DOMException("The user aborted a request.", "AbortError");
      };

      const context = await FirmsService.getThermalContext(18.5221, 73.8556);
      assert.strictEqual(context.available, false, "Should handle abort timeout gracefully");
      assert.strictEqual(context.error, "THERMAL_CONTEXT_UNAVAILABLE", "Should signal unavailable status");
    } finally {
      global.fetch = originalFetch;
      process.env.FIRMS_MAP_KEY = originalKey;
    }
  });

  // 4. Selection of the nearest detection
  test("Selecting the nearest thermal anomaly among multiple parsed CSV records", async () => {
    const originalKey = process.env.FIRMS_MAP_KEY;
    process.env.FIRMS_MAP_KEY = "test_fake_key";
    const originalFetch = global.fetch;

    try {
      // Return three anomalies on different distances:
      // Point 1: 18.5210, 73.8560 (~0.10km away from query 18.5204, 73.8567)
      // Point 2: 18.5290, 73.8500 (~1.20km away)
      // Point 3: 18.5990, 73.8990 (~9.50km away)
      const mockCsv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
18.5990,73.8990,320.0,0.4,0.4,2026-07-05,1045,N,VIIRS,n,1.0HS,293.2,5.0,D
18.5210,73.8560,345.2,0.4,0.4,2026-07-05,1045,N,VIIRS,h,1.0HS,293.2,12.5,D
18.5290,73.8500,330.0,0.4,0.4,2026-07-05,1045,N,VIIRS,l,1.0HS,293.2,6.0,D`;

      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          text: async () => mockCsv
        } as any;
      };

      const context = await FirmsService.getThermalContext(18.5204, 73.8567);
      assert.strictEqual(context.available, true);
      assert.strictEqual(context.detectionFound, true);
      // It should choose Point 1 as the closest
      assert.strictEqual(context.detectionLatitude, 18.5210);
      assert.strictEqual(context.detectionLongitude, 18.5210); // fixed rounding 4 decimals -> 18.5210 is parsed
      assert.strictEqual(context.confidence, "high"); // 'h' maps to 'high'
      assert.ok(context.nearestDetectionDistanceKm! < 0.2, `Expected distance to nearest detection under 0.2km, got ${context.nearestDetectionDistanceKm}`);
    } finally {
      global.fetch = originalFetch;
      process.env.FIRMS_MAP_KEY = originalKey;
    }
  });

  // 5. Correctness of scoring bounds (must be between 0.0 and 1.0)
  test("Correctness and limits of Signal Fusion heuristic and thermal modifier", () => {
    // Inputs that yield a score higher than 1.0 before capping
    const inputsOvercap = {
      citizenCorrelation: 1.0,
      visualEvidenceConfidence: 1.0,
      groundMonitoringAnomaly: 1.0,
      geospatialCorrelation: 1.0,
      temporalCorrelation: 1.0,
      atmosphericPersistence: 1.0,
      thermalContextScore: 1.0, // Should add +0.05
    };

    const result = SignalFusionService.evaluate(inputsOvercap);
    assert.strictEqual(result.finalScore, 1.0, "Score should never exceed the capped ceiling of 1.0");

    // Inputs with zero entries but high thermal modifier
    const inputsZero = {
      citizenCorrelation: 0.0,
      visualEvidenceConfidence: 0.0,
      groundMonitoringAnomaly: 0.0,
      geospatialCorrelation: 0.0,
      temporalCorrelation: 0.0,
      atmosphericPersistence: 0.0,
      thermalContextScore: 0.8, // should add 0.04
    };

    const resultZero = SignalFusionService.evaluate(inputsZero);
    assert.strictEqual(resultZero.finalScore, 0.04, `Score should reflect thermal modifier accurately, got ${resultZero.finalScore}`);
    assert.ok(resultZero.finalScore >= 0.0 && resultZero.finalScore <= 1.0, "Score must stay bounded between 0.0 and 1.0");
  });

  // 6. Dynamic trigger behavior based on event types (triggered on OPEN_WASTE_BURNING, not other types)
  test("Dynamic trigger condition matching only combustion event types", () => {
    const isCombustion = (type: string) => type === EventType.OPEN_WASTE_BURNING || type === EventType.INDUSTRIAL_SMOKE;

    assert.strictEqual(isCombustion(EventType.OPEN_WASTE_BURNING), true, "Should trigger on OPEN_WASTE_BURNING");
    assert.strictEqual(isCombustion(EventType.INDUSTRIAL_SMOKE), true, "Should trigger on INDUSTRIAL_SMOKE");
    assert.strictEqual(isCombustion(EventType.DUST_EMISSION), false, "Should not trigger on DUST_EMISSION");
    assert.strictEqual(isCombustion(EventType.CONSTRUCTION_DUST), false, "Should not trigger on CONSTRUCTION_DUST");
    assert.strictEqual(isCombustion(EventType.UNKNOWN), false, "Should not trigger on UNKNOWN");
  });

  // 7. Ground Monitoring & Signal Fusion Integration Tests
  test("Environmental context returns a resolved groundMonitoring object", async () => {
    const context = await GroundMonitoringService.getContext(18.5204, 73.8567, "OPEN_WASTE_BURNING");
    assert.strictEqual(typeof context, "object", "Should return an object");
    assert.strictEqual(context.available, true, "Should be available");
    assert.ok(context.stationName, "Should have stationName");
  });

  test("GroundMonitoring is never a Promise in the API response", async () => {
    const context = await GroundMonitoringService.getContext(18.5204, 73.8567);
    assert.ok(!(context instanceof Promise), "groundMonitoring should not be a Promise");
    assert.strictEqual(typeof (context as any).then, "undefined", "groundMonitoring should not be a Thenable");
  });

  test("Real anomalyScore is passed to SignalFusionService", () => {
    const inputs = {
      citizenCorrelation: 1.0,
      visualEvidenceConfidence: 0.9,
      groundMonitoringAnomaly: 0.75, // positive real anomalyScore
      geospatialCorrelation: 1.0,
      temporalCorrelation: 1.0,
      atmosphericPersistence: 0.85,
    };
    const result = SignalFusionService.evaluate(inputs);
    assert.strictEqual(result.groundMonitoringAnomaly, 0.75, "Real anomalyScore must be passed and returned in the evaluation");
  });

  test("anomalyAvailable=false results in groundMonitoringAnomaly=null", () => {
    const groundMonitoring = {
      available: true,
      stationName: "Pune CPCB Station",
      distanceKm: 2.1,
      pollutant: "PM2.5",
      currentValue: 120,
      baseline: null,
      relativeAnomaly: null,
      anomalyScore: null,
      anomalyAvailable: false,
      timestamp: new Date().toISOString(),
      source: "DATA_GOV_IN_CPCB"
    };

    const S = groundMonitoring.anomalyAvailable && typeof groundMonitoring.anomalyScore === "number"
      ? groundMonitoring.anomalyScore
      : null;

    assert.strictEqual(S, null, "When anomalyAvailable is false, S must be null");

    // Pass it to SignalFusionService
    const result = SignalFusionService.evaluate({
      citizenCorrelation: 1.0,
      visualEvidenceConfidence: 0.8,
      groundMonitoringAnomaly: S,
      geospatialCorrelation: 0.5,
      temporalCorrelation: 1.0,
      atmosphericPersistence: 0.85
    });

    assert.strictEqual(result.groundMonitoringAnomaly, null, "SignalFusionService must handle S=null correctly");
  });

  test("fusion available-evidence normalization works when S=null", () => {
    const result = SignalFusionService.evaluate({
      citizenCorrelation: 1.0,
      visualEvidenceConfidence: 0.8,
      groundMonitoringAnomaly: null,
      geospatialCorrelation: 1.0,
      temporalCorrelation: 1.0,
      atmosphericPersistence: 0.8,
    });

    // Weighted sum of active weights: 0.20*1.0 + 0.20*0.8 + 0.15*1.0 + 0.10*1.0 + 0.10*0.8 = 0.69
    // Active weights sum: 0.20 + 0.20 + 0.15 + 0.10 + 0.10 = 0.75
    // Normalized score: 0.69 / 0.75 = 0.92
    assert.strictEqual(result.finalScore, 0.92, `Expected normalized finalScore of 0.92, got ${result.finalScore}`);
    assert.deepStrictEqual(result.unavailableEvidenceDimensions, ["Ground Monitoring Anomaly"]);
    assert.ok(result.availableEvidenceDimensions.includes("Citizen Report Correlation"));
  });

  test("GroundMonitoringService is not called twice during one fusion evaluation flow", async () => {
    let callCount = 0;
    const originalGetContext = GroundMonitoringService.getContext;

    // Spy implementation
    GroundMonitoringService.getContext = async (lat, lng, eventType) => {
      callCount++;
      return originalGetContext.call(GroundMonitoringService, lat, lng, eventType);
    };

    try {
      // Simulating what happens during a fusion evaluation request:
      // 1. Resolve groundMonitoring once
      const groundMonitoring = await GroundMonitoringService.getContext(18.5204, 73.8567, "OPEN_WASTE_BURNING");
      
      // 2. Evaluate signal fusion
      const S = groundMonitoring.anomalyAvailable && typeof groundMonitoring.anomalyScore === "number"
        ? groundMonitoring.anomalyScore
        : null;

      const fusionBreakdown = SignalFusionService.evaluate({
        citizenCorrelation: 1.0,
        visualEvidenceConfidence: 0.9,
        groundMonitoringAnomaly: S,
        geospatialCorrelation: 1.0,
        temporalCorrelation: 1.0,
        atmosphericPersistence: 0.85
      });

      // 3. Create hotspot by reusing already resolved groundMonitoring (no 2nd getContext call)
      const hotspot = {
        id: "hotspot_test",
        fusion: fusionBreakdown,
        context: {
          groundMonitoring,
          satelliteContext: { available: false }
        }
      };

      assert.strictEqual(callCount, 1, `GroundMonitoringService.getContext should only be called once, called ${callCount} times`);
      assert.ok(hotspot.context.groundMonitoring, "Hotspot should contain the reused groundMonitoring object");
    } finally {
      GroundMonitoringService.getContext = originalGetContext;
    }
  });

  test("eventType is passed to GroundMonitoringService and pollutant selection works", async () => {
    const originalKey = process.env.DATA_GOV_IN_API_KEY;
    process.env.DATA_GOV_IN_API_KEY = "test_data_gov_key";
    const originalFetch = global.fetch;

    // Pune records containing PM10, PM2.5, and NO2
    const mockData = {
      records: [
        {
          state: "Maharashtra",
          city: "Pune",
          station: "Shivajinagar",
          pollutant_id: "NO2",
          avg_value: "45",
          latitude: "18.5304",
          longitude: "73.8485",
          last_update: "2026-07-05T10:45:00"
        },
        {
          state: "Maharashtra",
          city: "Pune",
          station: "Shivajinagar",
          pollutant_id: "PM10",
          avg_value: "180",
          latitude: "18.5304",
          longitude: "73.8485",
          last_update: "2026-07-05T10:45:00"
        },
        {
          state: "Maharashtra",
          city: "Pune",
          station: "Shivajinagar",
          pollutant_id: "PM2.5",
          avg_value: "110",
          latitude: "18.5304",
          longitude: "73.8485",
          last_update: "2026-07-05T10:45:00"
        }
      ]
    };

    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockData
      } as any;
    };

    try {
      // 1. For DUST_EMISSION, PM10 is preferred over others
      const dustContext = await GroundMonitoringService.getContext(18.5304, 73.8485, "DUST_EMISSION");
      assert.strictEqual(dustContext.pollutant, "PM10", "Should select PM10 for DUST_EMISSION");

      // 2. For TRAFFIC_SMOG, NO2 is preferred over PM10
      const trafficContext = await GroundMonitoringService.getContext(18.5304, 73.8485, "TRAFFIC_SMOG");
      assert.strictEqual(trafficContext.pollutant, "NO2", "Should select NO2 for TRAFFIC_SMOG");

      // 3. For OPEN_WASTE_BURNING, PM2.5 is preferred
      const wasteContext = await GroundMonitoringService.getContext(18.5304, 73.8485, "OPEN_WASTE_BURNING");
      assert.strictEqual(wasteContext.pollutant, "PM2.5", "Should select PM2.5 for OPEN_WASTE_BURNING");

    } finally {
      global.fetch = originalFetch;
      process.env.DATA_GOV_IN_API_KEY = originalKey;
    }
  });

  test("client-side demo fallback fusion behaves correctly when ground monitoring anomaly is unavailable", async () => {
    const originalLocalStorage = (global as any).localStorage;
    const store: Record<string, string> = {};
    (global as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { for (const k in store) delete store[k]; },
      length: 0,
      key: () => null,
    } as any;

    try {
      const { evaluateFusion } = await import("./src/services/api");

      const mockReport = {
        text: "Test waste burning report",
        language: "en" as const,
        latitude: 18.5204,
        longitude: 73.8567,
        analysis: {
          eventType: EventType.OPEN_WASTE_BURNING,
          pollutionTypes: ["SMOKE"],
          visualEvidence: { smokeDetected: true, smokeDensity: "HIGH" as const },
          severity: "HIGH" as any,
          confidence: 0.90,
          summary: "Test summary",
          evidence: ["Test evidence"]
        }
      };

      const result = await evaluateFusion(mockReport);
      
      assert.strictEqual(result.success, true, "demo flow still completes successfully");
      
      const S = result.fusion.groundMonitoringAnomaly;
      assert.strictEqual(S, null, "demo fallback does not hardcode S = 0.72 and unavailable ground anomaly results in S = null");

      // Verify normalization when S is null:
      // Dimensions: C=1.0, V=0.90, S=null, G=1.0, T=1.0, M=0.85
      // Weighted sum (excluding S):
      // (1.0 * 0.20) + (0.90 * 0.20) + (1.0 * 0.15) + (1.0 * 0.10) + (0.85 * 0.10) = 0.715
      // Total active weight = 0.20 + 0.20 + 0.15 + 0.10 + 0.10 = 0.75
      // Normalized Score = 0.715 / 0.75 = 0.95333... => parseFloat(score.toFixed(2)) = 0.95
      assert.strictEqual(result.fusion.finalScore, 0.95, "available evidence weights are normalized when S is null");

    } finally {
      (global as any).localStorage = originalLocalStorage;
    }
  });

  test("configured data.gov.in resource ID is exactly the official Real time Air Quality Index ID", () => {
    const content = fs.readFileSync("./services/groundMonitoringService.ts", "utf8");
    assert.ok(content.includes("3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"), "Resource ID should be 3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69");
    assert.ok(!content.includes("3b01bab4-073c-4ce7-bf95-7c961a868516"), "Old Resource ID must not be present");
  });

  console.log("-------------------------------------------------");
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("-------------------------------------------------");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
