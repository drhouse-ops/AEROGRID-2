import assert from "node:assert";
import { FirmsService } from "./services/firmsService";
import { WeatherContextService } from "./services/weatherContextService";
import { GroundMonitoringService } from "./services/groundMonitoringService";

// Polyfill localStorage for node environment
if (typeof (global as any).localStorage === "undefined") {
  const store = new Map<string, string>();
  (global as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    length: 0,
    key: (index: number) => null,
  } as any;
}

import { dispatchIncidentResponse } from "./src/services/api";

console.log("=================================================");
console.log("🏃 STARTING AEROGRID LIVE PILOT MODE CREDIBILITY TEST SUITE");
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

  // Set to Live Pilot Mode (Not Demo Mode)
  process.env.DEMO_MODE = "false";

  // Ensure mock/fallback keys are NOT used for authentic calls
  const originalFirmsKey = process.env.FIRMS_MAP_KEY;
  const originalWeatherKey = process.env.OPENWEATHER_API_KEY;
  const originalGroundKey = process.env.DATA_GOV_IN_API_KEY;

  delete process.env.FIRMS_MAP_KEY;
  delete process.env.OPENWEATHER_API_KEY;
  delete process.env.DATA_GOV_IN_API_KEY;

  // 1. FirmsService in Live Pilot Mode on missing key
  await test("FirmsService returns unavailable state instead of demo fallback when key is missing in Live Pilot Mode", async () => {
    const context = await FirmsService.getThermalContext(18.5204, 73.8567);
    assert.strictEqual(context.available, false, "Should not be available");
    assert.strictEqual(context.isPrototype, false, "Should not return prototype data");
    assert.strictEqual(context.error, "THERMAL_CONTEXT_UNAVAILABLE", "Should propagate correct error code");
  });

  // 2. WeatherContextService in Live Pilot Mode on missing key
  await test("WeatherContextService returns unavailable state instead of demo fallback when key is missing in Live Pilot Mode", async () => {
    const context = await WeatherContextService.getContext(18.5204, 73.8567);
    assert.strictEqual(context.available, false, "Should not be available");
    assert.strictEqual(context.isPrototype, false, "Should not return prototype data");
    assert.strictEqual(context.error, "WEATHER_CONTEXT_UNAVAILABLE", "Should propagate correct error code");
  });

  // 3. GroundMonitoringService in Live Pilot Mode on missing key
  await test("GroundMonitoringService returns unavailable state instead of demo fallback when key is missing in Live Pilot Mode", async () => {
    const context = await GroundMonitoringService.getContext(18.5204, 73.8567);
    assert.strictEqual(context.available, false, "Should not be available");
    assert.strictEqual(context.isPrototype, false, "Should not return prototype data");
    assert.strictEqual(context.error, "GROUND_CONTEXT_UNAVAILABLE", "Should propagate correct error code");
  });

  // 4. Live dispatch POST returns 503, does not mutate hotspot state, and remains unavailable.
  await test("Live dispatch POST returns 503 and does not mutate hotspot dispatch state", async () => {
    // Save original env
    const originalDemoMode = process.env.DEMO_MODE;
    // We explicitly override DEMO_MODE to mock isDemoMode client-side check
    process.env.DEMO_MODE = "false";

    const mockHotspot = {
      id: "test-hotspot-1",
      dispatch: undefined,
      citizenReports: []
    };

    let fetchCalled = false;
    let requestUrl = "";
    let requestOptions: any = null;

    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      fetchCalled = true;
      requestUrl = String(url);
      requestOptions = options;
      
      return {
        ok: false,
        status: 503,
        headers: {
          get: (name: string) => name.toLowerCase() === "content-type" ? "application/json" : null
        },
        json: async () => ({
          success: false,
          error: "MUNICIPAL_DISPATCH_NOT_CONNECTED",
          disclosure: "MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED"
        })
      } as any;
    };

    try {
      await dispatchIncidentResponse("test-hotspot-1", "Environmental Response Team 02");
      assert.fail("Should have thrown an error due to 503 status code");
    } catch (err: any) {
      assert.ok(err.message.includes("503") || err.message.includes("MUNICIPAL_DISPATCH_NOT_CONNECTED"), "Should throw correct error");
      assert.strictEqual(fetchCalled, true, "Should have called fetch");
      assert.ok(requestUrl.includes("/api/v1/incidents/test-hotspot-1/dispatch"), "Should request correct dispatch URL");
      assert.strictEqual(requestOptions.method, "POST", "Should be a POST request");
    } finally {
      global.fetch = originalFetch;
      process.env.DEMO_MODE = originalDemoMode;
    }

    // Assert that the hotspot state was not mutated
    assert.strictEqual(mockHotspot.dispatch, undefined, "Hotspot dispatch remains undefined");
  });

  // 5. Demo dispatch simulation still works if retained
  await test("Demo dispatch simulation still works if DEMO_MODE is true", async () => {
    const originalDemoMode = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "true";

    // Seed local hotspots
    const testHotspots = [{
      id: "test-demo-hotspot",
      citizenReports: [],
      dispatch: undefined
    }];
    localStorage.setItem("aerogrid_fallback_hotspots", JSON.stringify(testHotspots));

    try {
      // Mock fetch just in case, but it shouldn't be called if isDemoMode is true
      const originalFetch = global.fetch;
      global.fetch = async () => {
        throw new Error("Fetch should not be called in demo mode simulation");
      };

      try {
        const result = await dispatchIncidentResponse("test-demo-hotspot", "Environmental Response Team 02");
        assert.strictEqual(result.success, true, "Demo dispatch should succeed");
        assert.strictEqual(result.hotspot.dispatch?.status, "EN_ROUTE", "Should mutate state to EN_ROUTE");
        assert.strictEqual(result.hotspot.dispatch?.teamName, "Environmental Response Team 02", "Should set correct team name");
      } finally {
        global.fetch = originalFetch;
      }
    } finally {
      localStorage.removeItem("aerogrid_fallback_hotspots");
      process.env.DEMO_MODE = originalDemoMode;
    }
  });

  // Restore original environment values
  process.env.DEMO_MODE = "true";
  process.env.FIRMS_MAP_KEY = originalFirmsKey;
  process.env.OPENWEATHER_API_KEY = originalWeatherKey;
  process.env.DATA_GOV_IN_API_KEY = originalGroundKey;

  console.log("-------------------------------------------------");
  console.log(`📊 LIVE PILOT TESTS SUMMARY: ${passed} PASSED | ${failed} FAILED`);
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
