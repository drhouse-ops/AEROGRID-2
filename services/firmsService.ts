import { ThermalContext } from "../src/types/api";

export class FirmsService {
  /**
   * Retrieves NASA FIRMS thermal anomaly context for a given location.
   * If a FIRMS_MAP_KEY is configured, it queries the official NASA FIRMS Area endpoint.
   * Otherwise, or if the API call fails/times out, it falls back to a deterministic 
   * prototype fallback context (clearly marked as PROTOTYPE_THERMAL_CONTEXT) to 
   * keep the pilot demo fully functional and reliable.
   */
  static async getThermalContext(latitude: number, longitude: number): Promise<ThermalContext> {
    const isDemoMode = process.env.DEMO_MODE === "true";
    const key = process.env.FIRMS_MAP_KEY;

    if (!key) {
      if (isDemoMode) {
        console.log("No FIRMS_MAP_KEY found. Returning prototype thermal context.");
        return this.getPrototypeContext(latitude, longitude);
      } else {
        console.warn("No FIRMS_MAP_KEY found in Live Pilot Mode. Returning unavailable context.");
        return {
          available: false,
          detectionFound: false,
          error: "THERMAL_CONTEXT_UNAVAILABLE",
          source: "NASA FIRMS",
          isPrototype: false
        };
      }
    }

    // Determine query bounding box (approx 10 km search radius around coordinate)
    // 1 degree latitude = 111 km -> 10 km = ~0.0901 degrees
    // 1 degree longitude = 111 * cos(latitude) km -> at ~18.5 deg, 10 km = ~0.0949 degrees
    const latDiff = 10 / 111;
    const cosLat = Math.cos(latitude * Math.PI / 180);
    const lonDiff = 10 / (111 * (cosLat > 0 ? cosLat : 1));

    const minLat = latitude - latDiff;
    const maxLat = latitude + latDiff;
    const minLon = longitude - lonDiff;
    const maxLon = longitude + lonDiff;

    // FIRMS Area API coordinate order: min_lon, min_lat, max_lon, max_lat (west, south, east, north)
    const bbox = `${minLon.toFixed(4)},${minLat.toFixed(4)},${maxLon.toFixed(4)},${maxLat.toFixed(4)}`;
    
    // Dataset is VIIRS 375m (VIIRS_SNPP_NRT is standard)
    const dataset = "VIIRS_SNPP_NRT";
    const rangeDays = 1;
    const url = `https://firms.modaps.eosdis.nasa.gov/api/v1/area/${key}/${dataset}/${bbox}/${rangeDays}`;

    console.log(`Querying NASA FIRMS Area API: ${url.replace(key, "FIRMS_MAP_KEY_HIDDEN")}`);

    try {
      // Fetch with timeout of 6000ms
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`NASA FIRMS API responded with status ${response.status}`);
      }

      const csvText = await response.text();
      const detections = this.parseCSV(csvText);

      if (detections.length === 0) {
        return {
          available: true,
          detectionFound: false,
          source: "NASA FIRMS",
          isPrototype: false
        };
      }

      // Find the nearest detection using Haversine distance
      let nearestDetection: any = null;
      let minDistance = Infinity;

      for (const d of detections) {
        const dLat = parseFloat(d.latitude);
        const dLon = parseFloat(d.longitude);

        if (isNaN(dLat) || isNaN(dLon)) continue;

        const distance = this.getHaversineDistanceKm(latitude, longitude, dLat, dLon);
        if (distance < minDistance) {
          minDistance = distance;
          nearestDetection = d;
        }
      }

      if (!nearestDetection) {
        return {
          available: true,
          detectionFound: false,
          source: "NASA FIRMS",
          isPrototype: false
        };
      }

      // Map nominal/high/low confidence codes to readable labels
      let confidenceLabel = nearestDetection.confidence || "unknown";
      if (confidenceLabel.toLowerCase() === "n") confidenceLabel = "nominal";
      if (confidenceLabel.toLowerCase() === "h") confidenceLabel = "high";
      if (confidenceLabel.toLowerCase() === "l") confidenceLabel = "low";

      return {
        available: true,
        detectionFound: true,
        nearestDetectionDistanceKm: parseFloat(minDistance.toFixed(2)),
        detectionLatitude: parseFloat(parseFloat(nearestDetection.latitude).toFixed(4)),
        detectionLongitude: parseFloat(parseFloat(nearestDetection.longitude).toFixed(4)),
        acquisitionDate: nearestDetection.acq_date || nearestDetection.acquisition_date,
        acquisitionTime: nearestDetection.acq_time || nearestDetection.acquisition_time,
        satellite: nearestDetection.satellite === "N" ? "Suomi NPP" : (nearestDetection.satellite || "VIIRS Satellite"),
        instrument: nearestDetection.instrument || "VIIRS",
        confidence: confidenceLabel,
        brightness: nearestDetection.bright_ti4 ? parseFloat(parseFloat(nearestDetection.bright_ti4).toFixed(1)) : undefined,
        fireRadiativePower: nearestDetection.frp ? parseFloat(parseFloat(nearestDetection.frp).toFixed(1)) : undefined,
        dayNight: nearestDetection.daynight || nearestDetection.day_night,
        source: "NASA FIRMS",
        isPrototype: false
      };

    } catch (error: any) {
      console.warn("NASA FIRMS API retrieval failed. Returning unavailable context or prototype.", error.message);
      if (isDemoMode) {
        return this.getPrototypeContext(latitude, longitude);
      } else {
        return {
          available: false,
          detectionFound: false,
          error: "THERMAL_CONTEXT_UNAVAILABLE",
          source: "NASA FIRMS",
          isPrototype: false
        };
      }
    }
  }

  /**
   * Generates a deterministic prototype thermal context for simulation.
   * If location is within ~10km of the Pune Pilot Zone centroid (18.5221, 73.8556),
   * it returns a nearby thermal anomaly simulation.
   */
  static getPrototypeContext(latitude: number, longitude: number): ThermalContext {
    // Centroid of Pune Pilot Zone is (18.5221, 73.8556)
    const puneLat = 18.5221;
    const puneLng = 73.8556;
    const distFromPune = this.getHaversineDistanceKm(latitude, longitude, puneLat, puneLng);

    if (distFromPune <= 10) {
      // Simulate a detection close by
      return {
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
      };
    }

    return {
      available: true,
      detectionFound: false,
      source: "PROTOTYPE_THERMAL_CONTEXT",
      isPrototype: true
    };
  }

  public static parseCSV(csvText: string): any[] {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length <= 1) return [];

    const parseCSVLine = (text: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(val => val.replace(/^"|"$/g, ''));
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseCSVLine(line);
      const obj: any = {};
      headers.forEach((header, index) => {
        const cleanHeader = header.trim();
        obj[cleanHeader] = values[index] !== undefined ? values[index] : "";
      });
      results.push(obj);
    }
    return results;
  }

  public static getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
