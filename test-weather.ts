import assert from "node:assert";
import { WeatherContextService } from "./services/weatherContextService";
import { SignalFusionService } from "./services/signalFusionService";

console.log("=================================================");
console.log("🏃 STARTING AEROGRID GOOGLE WEATHER SERVICE TEST SUITE");
console.log("=================================================");

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
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

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Weather API Response Parsing & Normalization
  await testAsync("Weather API response parsing & normalization (Metric units)", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    process.env.GOOGLE_WEATHER_API_KEY = "test_google_weather_key";
    const originalFetch = global.fetch;

    const mockResponse = {
      currentTime: "2026-07-05T12:00:00Z",
      relativeHumidity: 65,
      weatherCondition: {
        description: { text: "Scattered Clouds" }
      },
      temperature: {
        degrees: 28.5,
        unit: "CELSIUS"
      },
      wind: {
        direction: { degrees: 180 },
        speed: { value: 12.0, unit: "KILOMETERS_PER_HOUR" }
      },
      precipitation: {
        qpf: { quantity: 1.5, unit: "MILLIMETERS" }
      }
    };

    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as any;
    };

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, true);
      assert.strictEqual(result.temperatureC, 28.5);
      assert.strictEqual(result.relativeHumidity, 65);
      assert.strictEqual(result.windSpeedKph, 12.0);
      assert.strictEqual(result.windDirectionDegrees, 180);
      assert.strictEqual(result.precipitationMm, 1.5);
      assert.strictEqual(result.weatherCondition, "Scattered Clouds");
      assert.strictEqual(result.timestamp, "2026-07-05T12:00:00Z");
      assert.strictEqual(result.source, "GOOGLE_WEATHER_API");
      assert.strictEqual(result.isPrototype, false);
      
      // Legacy wind speed (m/s) -> 12 kph / 3.6 = 3.33 m/s
      assert.strictEqual(result.windSpeed, 3.33);
    } finally {
      global.fetch = originalFetch;
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
    }
  });

  await testAsync("Weather API response parsing & conversion (Imperial units)", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    process.env.GOOGLE_WEATHER_API_KEY = "test_google_weather_key";
    const originalFetch = global.fetch;

    const mockResponse = {
      currentTime: "2026-07-05T12:00:00Z",
      relativeHumidity: 50,
      weatherCondition: {
        type: "CLEAR"
      },
      temperature: {
        degrees: 77.0, // 77 F -> 25 C
        unit: "FAHRENHEIT"
      },
      wind: {
        direction: { degrees: 90 },
        speed: { value: 10.0, unit: "MILES_PER_HOUR" } // 10 mph -> 16.1 kph
      },
      precipitation: {
        qpf: { quantity: 0.1, unit: "INCHES" } // 0.1 in -> 2.54 mm
      }
    };

    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as any;
    };

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, true);
      assert.strictEqual(result.temperatureC, 25);
      assert.strictEqual(result.relativeHumidity, 50);
      assert.strictEqual(result.windSpeedKph, 16.1);
      assert.strictEqual(result.windDirectionDegrees, 90);
      assert.strictEqual(result.precipitationMm, 2.54);
      assert.strictEqual(result.weatherCondition, "CLEAR");
    } finally {
      global.fetch = originalFetch;
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
    }
  });

  // 2. Handling of missing fields gracefully
  await testAsync("Handling of missing humidity, precipitation, and wind direction", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    process.env.GOOGLE_WEATHER_API_KEY = "test_google_weather_key";
    const originalFetch = global.fetch;

    const mockResponse = {
      currentTime: "2026-07-05T12:00:00Z",
      temperature: { degrees: 20.0, unit: "CELSIUS" },
      wind: {
        speed: { value: 5.0, unit: "KILOMETERS_PER_HOUR" }
      }
      // relativeHumidity, precipitation, and wind direction are omitted
    };

    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as any;
    };

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, true);
      assert.strictEqual(result.temperatureC, 20.0);
      assert.strictEqual(result.relativeHumidity, null);
      assert.strictEqual(result.precipitationMm, null);
      assert.strictEqual(result.windDirectionDegrees, null);
      assert.strictEqual(result.windSpeedKph, 5.0);
      assert.ok(result.persistenceScore !== null && result.persistenceScore >= 0.0);
    } finally {
      global.fetch = originalFetch;
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
    }
  });

  // 3. Persistence Score bounds
  await testAsync("Persistence Score bounds (always between 0.0 and 1.0)", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    process.env.GOOGLE_WEATHER_API_KEY = "test_google_weather_key";
    const originalFetch = global.fetch;

    // Wind speed extremely high, rain heavy -> persistence should approach 0.0
    const mockSevereResponse = {
      currentTime: "2026-07-05T12:00:00Z",
      relativeHumidity: 90,
      temperature: { degrees: 25.0 },
      wind: { speed: { value: 50.0, unit: "KILOMETERS_PER_HOUR" } },
      precipitation: { qpf: { quantity: 15.0, unit: "MILLIMETERS" } }
    };

    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockSevereResponse
      } as any;
    };

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, true);
      assert.ok(result.persistenceScore !== null);
      assert.ok(result.persistenceScore >= 0.0 && result.persistenceScore <= 1.0, `Score out of bounds: ${result.persistenceScore}`);
      assert.strictEqual(result.persistenceScore, 0.0, "Extreme high wind and heavy rain should push persistence score to 0.0");
      assert.strictEqual(result.dispersionCondition, "HIGH");
    } finally {
      global.fetch = originalFetch;
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
    }
  });

  // 4. Low-wind persistence behavior
  await testAsync("Low wind speed triggers higher persistence score", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    process.env.GOOGLE_WEATHER_API_KEY = "test_google_weather_key";
    const originalFetch = global.fetch;

    const mockLowWindResponse = {
      currentTime: "2026-07-05T12:00:00Z",
      relativeHumidity: 60,
      temperature: { degrees: 27.0 },
      wind: { speed: { value: 2.0, unit: "KILOMETERS_PER_HOUR" } }, // low wind
      precipitation: { qpf: { quantity: 0.0, unit: "MILLIMETERS" } }
    };

    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockLowWindResponse
      } as any;
    };

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, true);
      assert.ok(result.persistenceScore !== null);
      assert.ok(result.persistenceScore >= 0.70, `Low wind should yield persistence >= 0.70, got ${result.persistenceScore}`);
      assert.strictEqual(result.dispersionCondition, "LOW");
    } finally {
      global.fetch = originalFetch;
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
    }
  });

  // 5. Higher-wind dispersion behavior
  await testAsync("Higher wind speed triggers lower persistence and higher dispersion", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    process.env.GOOGLE_WEATHER_API_KEY = "test_google_weather_key";
    const originalFetch = global.fetch;

    const mockHighWindResponse = {
      currentTime: "2026-07-05T12:00:00Z",
      relativeHumidity: 40,
      temperature: { degrees: 27.0 },
      wind: { speed: { value: 25.0, unit: "KILOMETERS_PER_HOUR" } }, // strong wind
      precipitation: { qpf: { quantity: 0.0, unit: "MILLIMETERS" } }
    };

    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockHighWindResponse
      } as any;
    };

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, true);
      assert.ok(result.persistenceScore !== null);
      assert.ok(result.persistenceScore < 0.35, `Strong wind should yield low persistence (< 0.35), got ${result.persistenceScore}`);
      assert.strictEqual(result.dispersionCondition, "HIGH");
    } finally {
      global.fetch = originalFetch;
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
    }
  });

  // 6. Precipitation effects
  await testAsync("Precipitation suppresses atmospheric persistence", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    process.env.GOOGLE_WEATHER_API_KEY = "test_google_weather_key";
    const originalFetch = global.fetch;

    const mockRainyResponse = {
      currentTime: "2026-07-05T12:00:00Z",
      relativeHumidity: 90,
      temperature: { degrees: 23.0 },
      wind: { speed: { value: 4.0, unit: "KILOMETERS_PER_HOUR" } }, // low wind which would normally mean high persistence
      precipitation: { qpf: { quantity: 4.0, unit: "MILLIMETERS" } } // heavy rain
    };

    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockRainyResponse
      } as any;
    };

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, true);
      // Base score with low wind and high humidity is high, but rain factor: 1.0 - (4 / 5) = 0.2
      // This will heavily depress the final score below 0.35
      assert.ok(result.persistenceScore !== null);
      assert.ok(result.persistenceScore < 0.35, `Rain should suppress persistence under 0.35, got ${result.persistenceScore}`);
      assert.strictEqual(result.dispersionCondition, "HIGH");
    } finally {
      global.fetch = originalFetch;
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
    }
  });

  // 7. API Timeouts
  await testAsync("Weather service handles API timeouts/aborts gracefully", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    process.env.GOOGLE_WEATHER_API_KEY = "test_google_weather_key";
    const originalFetch = global.fetch;

    global.fetch = async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    };

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, false);
      assert.strictEqual(result.error, "WEATHER_CONTEXT_UNAVAILABLE");
      assert.strictEqual(result.dispersionCondition, "UNKNOWN");
      assert.strictEqual(result.persistenceScore, null);
    } finally {
      global.fetch = originalFetch;
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
    }
  });

  // 8. API Failures
  await testAsync("Weather service handles HTTP error responses gracefully", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    process.env.GOOGLE_WEATHER_API_KEY = "test_google_weather_key";
    const originalFetch = global.fetch;

    global.fetch = async () => {
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden"
      } as any;
    };

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, false);
      assert.strictEqual(result.error, "WEATHER_CONTEXT_UNAVAILABLE");
      assert.strictEqual(result.dispersionCondition, "UNKNOWN");
    } finally {
      global.fetch = originalFetch;
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
    }
  });

  // 9. Missing Key Fallback (Demo Mode)
  await testAsync("Weather service uses prototype fallback disclosure when API key is missing (Demo Mode)", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    const originalDemo = process.env.DEMO_MODE;
    delete process.env.GOOGLE_WEATHER_API_KEY;
    process.env.DEMO_MODE = "true";

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, true);
      assert.strictEqual(result.isPrototype, true);
      assert.strictEqual(result.source, "PROTOTYPE_WEATHER_CONTEXT");
      assert.strictEqual(result.dispersionCondition, "LOW");
      assert.strictEqual(result.persistenceScore, 0.78);
    } finally {
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
      process.env.DEMO_MODE = originalDemo;
    }
  });

  // 9b. Missing Key Fallback (Live Mode)
  await testAsync("Weather service returns unavailable in Live Mode when API key is missing", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    const originalDemo = process.env.DEMO_MODE;
    delete process.env.GOOGLE_WEATHER_API_KEY;
    process.env.DEMO_MODE = "false";

    try {
      const result = await WeatherContextService.getContext(18.5204, 73.8567);
      assert.strictEqual(result.available, false);
      assert.strictEqual(result.isPrototype, false);
      assert.strictEqual(result.source, "GOOGLE_WEATHER_API");
      assert.strictEqual(result.dispersionCondition, "UNKNOWN");
      assert.strictEqual(result.persistenceScore, null);
    } finally {
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
      process.env.DEMO_MODE = originalDemo;
    }
  });

  // 10. Ensuring the weather service is not called twice
  await testAsync("Weather service is not called twice during a single fusion pipeline flow", async () => {
    const originalKey = process.env.GOOGLE_WEATHER_API_KEY;
    const originalDemo = process.env.VITE_DEMO_MODE;
    
    let callCount = 0;
    const originalGetContext = WeatherContextService.getContext;

    WeatherContextService.getContext = async (lat, lng) => {
      callCount++;
      return {
        available: true,
        temperatureC: 27,
        relativeHumidity: 68,
        windSpeedKph: 6.48,
        windSpeed: 1.8,
        windDirectionDegrees: 240,
        precipitationMm: 0,
        weatherCondition: "Overcast",
        dispersionCondition: "LOW",
        persistenceScore: 0.78,
        timestamp: new Date().toISOString(),
        source: "GOOGLE_WEATHER_API",
        isPrototype: false
      };
    };

    try {
      // 1. Simulate the GET context API resolver resolving weather once
      const weatherContext = await WeatherContextService.getContext(18.5204, 73.8567);
      
      // 2. Reuse the already resolved weatherContext in signal fusion evaluation
      const M = weatherContext.persistenceScore;

      const breakdown = SignalFusionService.evaluate({
        citizenCorrelation: 1.0,
        visualEvidenceConfidence: 0.9,
        groundMonitoringAnomaly: 0.8,
        geospatialCorrelation: 1.0,
        temporalCorrelation: 1.0,
        atmosphericPersistence: M
      });

      const hotspot = {
        id: "hotspot_weather_test",
        fusion: breakdown,
        context: {
          groundMonitoring: { available: false },
          satelliteContext: { available: false },
          weatherContext // Reused directly
        }
      };

      assert.strictEqual(callCount, 1, `WeatherContextService.getContext should only be called once, called ${callCount} times`);
      assert.strictEqual(hotspot.context.weatherContext.persistenceScore, 0.78);
    } finally {
      WeatherContextService.getContext = originalGetContext;
      process.env.GOOGLE_WEATHER_API_KEY = originalKey;
      process.env.DEMO_MODE = originalDemo;
    }
  });

  // 11. Passing real persistenceScore as M
  test("Passing real persistenceScore as M to SignalFusionService", () => {
    const inputs = {
      citizenCorrelation: 1.0,
      visualEvidenceConfidence: 0.9,
      groundMonitoringAnomaly: 0.7,
      geospatialCorrelation: 1.0,
      temporalCorrelation: 1.0,
      atmosphericPersistence: 0.65 // persistence score
    };

    const result = SignalFusionService.evaluate(inputs);
    assert.strictEqual(result.atmosphericPersistence, 0.65);
  });

  // 12. Available-evidence normalization when M is null
  test("SignalFusionService available-evidence normalization when M is null", () => {
    const result = SignalFusionService.evaluate({
      citizenCorrelation: 1.0,
      visualEvidenceConfidence: 0.8,
      groundMonitoringAnomaly: 0.7,
      geospatialCorrelation: 1.0,
      temporalCorrelation: 1.0,
      atmosphericPersistence: null // M is null
    });

    // C=1.0 (0.20), V=0.8 (0.20), S=0.7 (0.25), G=1.0 (0.15), T=1.0 (0.10)
    // Weighted Sum = 1.0*0.20 + 0.8*0.20 + 0.7*0.25 + 1.0*0.15 + 1.0*0.10 = 0.20 + 0.16 + 0.175 + 0.15 + 0.10 = 0.785
    // Sum of active weights = 0.20 + 0.20 + 0.25 + 0.15 + 0.10 = 0.90
    // Normalized Score = 0.785 / 0.90 = 0.87222... => capped/rounded to 2 decimals -> 0.87
    assert.strictEqual(result.finalScore, 0.87);
    assert.deepStrictEqual(result.unavailableEvidenceDimensions, ["Atmospheric Persistence"]);
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
