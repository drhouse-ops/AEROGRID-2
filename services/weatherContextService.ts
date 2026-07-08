import { WeatherContext } from "../src/types/api";

/**
 * Service to retrieve real-time weather and atmospheric dispersion context
 * using the official Google Maps Platform Weather API.
 * 
 * "Weather persistence scoring is a prototype heuristic intended for pilot calibration 
 * and is not a CFD or regulatory atmospheric dispersion model."
 */
export class WeatherContextService {
  /**
   * Retrieves current weather conditions and estimates atmospheric dispersion conditions.
   * Uses GOOGLE_WEATHER_API_KEY from environment variables.
   */
  static async getContext(latitude: number, longitude: number): Promise<WeatherContext> {
    const isDemoMode = process.env.VITE_DEMO_MODE === "true";
    const apiKey = process.env.GOOGLE_WEATHER_API_KEY;

    if (!apiKey) {
      if (isDemoMode) {
        console.log("No GOOGLE_WEATHER_API_KEY found. Returning prototype weather context fallback.");
        return this.getPrototypeContext(latitude, longitude);
      } else {
        console.warn("No GOOGLE_WEATHER_API_KEY found in Live Pilot Mode. Returning unavailable weather context.");
        return {
          available: false,
          dispersionCondition: "UNKNOWN",
          persistenceScore: null,
          source: "GOOGLE_WEATHER_API",
          isPrototype: false,
          error: "WEATHER_CONTEXT_UNAVAILABLE"
        };
      }
    }

    const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=${latitude}&location.longitude=${longitude}`;
    const sanitizedUrlForLog = `https://weather.googleapis.com/v1/currentConditions:lookup?key=GOOGLE_WEATHER_API_KEY_HIDDEN&location.latitude=${latitude}&location.longitude=${longitude}`;
    console.log(`Querying Google Weather API: ${sanitizedUrlForLog}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Google Weather API responded with status ${response.status}`);
      }

      const data = await response.json();
      if (!data) {
        throw new Error("Empty response body from Google Weather API");
      }

      // 1. Temperature Normalization (convert Fahrenheit if needed, default is Celsius)
      let temperatureC: number | null = null;
      if (data.temperature && typeof data.temperature.degrees === "number") {
        if (data.temperature.unit === "FAHRENHEIT") {
          temperatureC = parseFloat(((data.temperature.degrees - 32) * 5 / 9).toFixed(1));
        } else {
          temperatureC = data.temperature.degrees;
        }
      }

      // 2. Relative Humidity
      const relativeHumidity: number | null = typeof data.relativeHumidity === "number" ? data.relativeHumidity : null;

      // 3. Wind Speed Normalization (target: windSpeedKph, convert Miles if needed, default is kph)
      let windSpeedKph: number | null = null;
      if (data.wind?.speed && typeof data.wind.speed.value === "number") {
        if (data.wind.speed.unit === "MILES_PER_HOUR") {
          windSpeedKph = parseFloat((data.wind.speed.value * 1.60934).toFixed(1));
        } else {
          windSpeedKph = data.wind.speed.value;
        }
      }

      // Legacy wind speed in m/s for backward compatibility
      const windSpeed = windSpeedKph !== null ? parseFloat((windSpeedKph / 3.6).toFixed(2)) : undefined;

      // 4. Wind Direction
      const windDirectionDegrees: number | null = 
        data.wind?.direction && typeof data.wind.direction.degrees === "number"
          ? data.wind.direction.degrees
          : null;

      // 5. Precipitation Normalization (target: precipitationMm, convert inches if needed, default is mm)
      let precipitationMm: number | null = null;
      if (data.precipitation?.qpf && typeof data.precipitation.qpf.quantity === "number") {
        if (data.precipitation.qpf.unit === "INCHES") {
          precipitationMm = parseFloat((data.precipitation.qpf.quantity * 25.4).toFixed(2));
        } else {
          precipitationMm = data.precipitation.qpf.quantity;
        }
      }

      // 6. Weather Condition
      let weatherCondition: string | null = null;
      if (data.weatherCondition?.description?.text) {
        weatherCondition = data.weatherCondition.description.text;
      } else if (data.weatherCondition?.type) {
        weatherCondition = data.weatherCondition.type;
      }

      const timestamp = data.currentTime || new Date().toISOString();

      // 7. Heuristic Dispersion & Persistence Scoring Engine
      // "Weather persistence scoring is a prototype heuristic intended for pilot calibration and is not a CFD or regulatory atmospheric dispersion model."
      // Formula design:
      // - Wind Speed reduces persistence: 0 at >=20 km/h, 1 at 0 km/h
      // - Precipitation reduces persistence: multiplier rainFactor scales down persistence towards 0
      // - Humidity increases persistence: humid air pools particles
      const speedValueForCalc = windSpeedKph !== null ? windSpeedKph : 6.48; // default to 6.48 kph (1.8 m/s) if null
      const windScore = Math.max(0.0, Math.min(1.0, 1.0 - (speedValueForCalc / 20.0)));
      
      const rainValueForCalc = precipitationMm !== null ? precipitationMm : 0;
      const rainFactor = Math.max(0.0, Math.min(1.0, 1.0 - (rainValueForCalc / 5.0)));
      
      const humidityValueForCalc = relativeHumidity !== null ? relativeHumidity : 50;
      const humidityScore = humidityValueForCalc / 100;

      // Weighted combination of wind score (70%) and humidity score (30%)
      const basePersistence = (0.7 * windScore) + (0.3 * humidityScore);
      // Rain suppresses persistence
      const persistenceScoreRaw = basePersistence * rainFactor;
      const persistenceScore = parseFloat(Math.max(0.0, Math.min(1.0, persistenceScoreRaw)).toFixed(2));

      // Determine dispersion condition classification based on persistence score bounds
      let dispersionCondition: "LOW" | "MODERATE" | "HIGH" | "UNKNOWN" = "UNKNOWN";
      if (persistenceScore >= 0.70) {
        dispersionCondition = "LOW";
      } else if (persistenceScore >= 0.35) {
        dispersionCondition = "MODERATE";
      } else {
        dispersionCondition = "HIGH";
      }

      return {
        available: true,
        temperatureC,
        relativeHumidity,
        windSpeedKph,
        windDirectionDegrees,
        precipitationMm,
        weatherCondition,
        dispersionCondition,
        persistenceScore,
        timestamp,
        source: "GOOGLE_WEATHER_API",
        isPrototype: false,
        windSpeed
      };

    } catch (err: any) {
      console.error("Failed to query Google Weather API:", err.message);
      return {
        available: false,
        dispersionCondition: "UNKNOWN",
        persistenceScore: null,
        source: "GOOGLE_WEATHER_API",
        isPrototype: false,
        error: "WEATHER_CONTEXT_UNAVAILABLE"
      };
    }
  }

  /**
   * Prototype fallback context for the weather system.
   */
  static getPrototypeContext(latitude: number, longitude: number): WeatherContext {
    return {
      available: true,
      temperatureC: 27,
      relativeHumidity: 68,
      windSpeedKph: 6.48, // 1.8 m/s * 3.6 = 6.48 kph
      windSpeed: 1.8,
      windDirectionDegrees: 240,
      precipitationMm: 0,
      weatherCondition: "Overcast",
      dispersionCondition: "LOW",
      persistenceScore: 0.78,
      timestamp: new Date().toISOString(),
      source: "PROTOTYPE_WEATHER_CONTEXT",
      isPrototype: true
    };
  }
}
