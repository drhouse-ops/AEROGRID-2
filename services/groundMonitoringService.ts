import { GroundMonitoring } from "../src/types/api";

interface StationCoords {
  latitude: number;
  longitude: number;
}

/**
 * Verified station coordinates for Pune CPCB/MPCB stations.
 * Source: SAFAR (System of Air Quality and Weather Forecasting and Research) 
 * monitoring network, Indian Institute of Tropical Meteorology (IITM) under 
 * Ministry of Earth Sciences, Govt. of India.
 */
const VERIFIED_STATION_COORDINATES: { [key: string]: StationCoords } = {
  "shivajinagar": { latitude: 18.5304, longitude: 73.8485 },
  "karve road": { latitude: 18.5028, longitude: 73.8291 },
  "bhosari": { latitude: 18.6225, longitude: 73.8425 },
  "hadapsar": { latitude: 18.5050, longitude: 73.9248 },
  "pimpri": { latitude: 18.6247, longitude: 73.8011 },
  "katraj": { latitude: 18.4575, longitude: 73.8550 },
  "alandi": { latitude: 18.6750, longitude: 73.8872 },
  "lohegaon": { latitude: 18.5800, longitude: 73.9200 },
  "solapur road": { latitude: 18.5030, longitude: 73.8760 },
  "nal stop": { latitude: 18.5075, longitude: 73.8295 }
};

interface HistoricalRecord {
  stationName: string;
  pollutant: string;
  value: number;
  timestamp: string;
}

interface NormalizedObservation {
  stationName: string;
  latitude: number | null;
  longitude: number | null;
  pollutant: string;
  currentValue: number;
  minValue: number | null;
  maxValue: number | null;
  timestamp: string;
  source: "DATA_GOV_IN_CPCB";
}

export class GroundMonitoringService {
  // In-memory rolling cache of previous observations for baseline calculation
  public static historyMap: Map<string, HistoricalRecord> = new Map();

  public static get history(): HistoricalRecord[] {
    return Array.from(this.historyMap.values());
  }

  public static set history(val: HistoricalRecord[]) {
    this.historyMap.clear();
    for (const record of val) {
      const key = `${record.stationName}|${record.pollutant}|${record.timestamp}`;
      this.historyMap.set(key, record);
    }
  }

  /**
   * Retrieves ground monitoring environmental context for a given location.
   * Connects to the official data.gov.in real-time ambient air quality dataset.
   */
  static async getContext(latitude: number, longitude: number, eventType?: string): Promise<GroundMonitoring> {
    const isDemoMode = process.env.DEMO_MODE === "true";
    const key = process.env.DATA_GOV_IN_API_KEY;

    if (!key) {
      if (isDemoMode) {
        console.log("No DATA_GOV_IN_API_KEY found. Returning prototype fallback context.");
        return this.getPrototypeContext(latitude, longitude);
      } else {
        console.warn("No DATA_GOV_IN_API_KEY found in Live Pilot Mode. Returning unavailable ground context.");
        return {
          available: false,
          anomalyAvailable: false,
          baseline: null,
          relativeAnomaly: null,
          source: "DATA_GOV_IN_CPCB",
          isPrototype: false,
          error: "GROUND_CONTEXT_UNAVAILABLE"
        };
      }
    }

    const resourceId = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";
    const baseUrl = `https://api.data.gov.in/resource/${resourceId}`;
    const params = new URLSearchParams({
      "api-key": key,
      "format": "json",
      "limit": "1000",
      "filters[state]": "Maharashtra",
      "filters[city]": "Pune"
    });
    const url = `${baseUrl}?${params.toString()}`;

    const sanitizedUrlForLog = `${baseUrl}?${new URLSearchParams({
      "api-key": "DATA_GOV_IN_API_KEY_HIDDEN",
      "format": "json",
      "limit": "1000",
      "filters[state]": "Maharashtra",
      "filters[city]": "Pune"
    }).toString()}`;
    console.log(`Querying data.gov.in CPCB Air Quality API: ${sanitizedUrlForLog}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`data.gov.in API responded with status ${response.status}`);
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.records)) {
        throw new Error("Invalid response format from data.gov.in");
      }

      const records = data.records;
      const total = data.total;
      const count = data.count;
      
      const recordFieldNames = records.length > 0 ? Object.keys(records[0]) : [];
      const distinctStates = Array.from(new Set(records.map((r: any) => r.state).filter(Boolean)));
      const distinctCities = Array.from(new Set(records.map((r: any) => r.city).filter(Boolean)));

      console.log("data.gov.in Safe Diagnostic Metadata:", {
        total,
        count,
        recordFieldNames,
        distinctStates,
        distinctCities
      });

      const normalizedObs: NormalizedObservation[] = [];

      for (const rec of records) {
        // Double check state and city filters case-insensitively to prevent errors
        const state = (rec.state || "").trim().toLowerCase();
        const city = (rec.city || "").trim().toLowerCase();
        
        if (state !== "maharashtra" || city !== "pune") {
          continue;
        }

        const stationName = rec.station;
        const pollutant = (rec.pollutant_id || "").trim();
        const rawVal = rec.avg_value;

        if (!stationName || !pollutant || rawVal === undefined || rawVal === null || rawVal === "NA" || rawVal === "") {
          continue;
        }

        const currentValue = parseFloat(rawVal);
        if (isNaN(currentValue)) {
          continue; // Ignore malformed pollutant observations
        }

        const minValue = rec.min_value && rec.min_value !== "NA" ? parseFloat(rec.min_value) : null;
        const maxValue = rec.max_value && rec.max_value !== "NA" ? parseFloat(rec.max_value) : null;

        // Extract station coordinates from API if present, otherwise look up in verified config
        let lat: number | null = null;
        let lng: number | null = null;
        
        if (rec.latitude && !isNaN(parseFloat(rec.latitude))) {
          lat = parseFloat(rec.latitude);
        }
        if (rec.longitude && !isNaN(parseFloat(rec.longitude))) {
          lng = parseFloat(rec.longitude);
        }

        if (lat === null || lng === null) {
          const verified = this.getStationCoordinates(stationName);
          if (verified) {
            lat = verified.latitude;
            lng = verified.longitude;
          }
        }

        normalizedObs.push({
          stationName,
          latitude: lat,
          longitude: lng,
          pollutant,
          currentValue,
          minValue: isNaN(minValue as any) ? null : minValue,
          maxValue: isNaN(maxValue as any) ? null : maxValue,
          timestamp: rec.last_update || new Date().toISOString(),
          source: "DATA_GOV_IN_CPCB"
        });
      }

      if (normalizedObs.length === 0) {
        console.warn("No active Pune air quality observations found in data.gov.in response.");
        return {
          available: false,
          anomalyAvailable: false,
          baseline: null,
          relativeAnomaly: null,
          source: "DATA_GOV_IN_CPCB",
          isPrototype: false,
          error: "GROUND_CONTEXT_UNAVAILABLE"
        };
      }

      // Populate history cache for rolling baseline
      for (const obs of normalizedObs) {
        const key = `${obs.stationName}|${obs.pollutant}|${obs.timestamp}`;
        if (!this.historyMap.has(key)) {
          this.historyMap.set(key, {
            stationName: obs.stationName,
            pollutant: obs.pollutant,
            value: obs.currentValue,
            timestamp: obs.timestamp
          });
        }
      }

      // Cap cache size to avoid memory leaks (last 1000 observations)
      if (this.historyMap.size > 1000) {
        const keys = Array.from(this.historyMap.keys());
        const keysToDelete = keys.slice(0, keys.length - 1000);
        for (const k of keysToDelete) {
          this.historyMap.delete(k);
        }
      }

      // Pollutant Selection by Event Type
      const preferredList = this.getPreferredPollutants(eventType);
      
      // Select nearest station with verified coordinates and valid preferred observation
      let chosenStationObs: NormalizedObservation | null = null;
      let minDistance = Infinity;

      for (const prefPollutant of preferredList) {
        const candidates = normalizedObs.filter(o => o.pollutant.toLowerCase() === prefPollutant.toLowerCase());
        if (candidates.length === 0) continue;

        // Try to find nearest station using coordinates
        for (const cand of candidates) {
          if (cand.latitude !== null && cand.longitude !== null) {
            const dist = this.getHaversineDistanceKm(latitude, longitude, cand.latitude, cand.longitude);
            if (dist < minDistance) {
              minDistance = dist;
              chosenStationObs = cand;
            }
          }
        }

        // If we found a candidate with distance, we've successfully got the nearest for our highest preferred pollutant
        if (chosenStationObs) break;

        // If no station has coordinates, fall back to the first available candidate for this pollutant
        if (candidates.length > 0) {
          chosenStationObs = candidates[0];
          break;
        }
      }

      // If we still don't have a match, default to any available pollutant on any Pune station
      if (!chosenStationObs) {
        chosenStationObs = normalizedObs[0];
      }

      const finalStationName = chosenStationObs.stationName;
      const finalPollutant = chosenStationObs.pollutant;
      const finalValue = chosenStationObs.currentValue;

      // Calculate baseline and anomaly
      const pollutantHistory = this.history
        .filter(h => h.stationName === finalStationName && h.pollutant.toLowerCase() === finalPollutant.toLowerCase())
        .map(h => h.value);

      let baseline: number | null = null;
      let relativeAnomaly: number | null = null;
      let anomalyScore: number | null = null;
      let anomalyAvailable = false;

      // We need at least 3 historical data points to calculate a robust baseline
      if (pollutantHistory.length >= 3) {
        baseline = this.calculateMedian(pollutantHistory);
        if (baseline > 0) {
          relativeAnomaly = parseFloat(((finalValue - baseline) / baseline).toFixed(3));
          anomalyScore = parseFloat(Math.max(0.0, Math.min(1.0, relativeAnomaly)).toFixed(2));
          anomalyAvailable = true;
        }
      }

      const hasCoords = chosenStationObs.latitude !== null && chosenStationObs.longitude !== null;
      const finalDistance = hasCoords ? parseFloat(this.getHaversineDistanceKm(latitude, longitude, chosenStationObs.latitude!, chosenStationObs.longitude!).toFixed(1)) : undefined;

      return {
        available: true,
        stationName: finalStationName,
        distanceKm: finalDistance,
        pollutant: finalPollutant,
        currentValue: finalValue,
        baseline,
        relativeAnomaly,
        anomalyScore,
        anomalyAvailable,
        timestamp: chosenStationObs.timestamp,
        source: "DATA_GOV_IN_CPCB",
        isPrototype: false
      };

    } catch (err: any) {
      console.error("Failed to query data.gov.in air quality service:", err.message);
      return {
        available: false,
        anomalyAvailable: false,
        baseline: null,
        relativeAnomaly: null,
        source: "DATA_GOV_IN_CPCB",
        isPrototype: false,
        error: "GROUND_CONTEXT_UNAVAILABLE"
      };
    }
  }

  private static getStationCoordinates(stationName: string): StationCoords | null {
    const normalized = stationName.toLowerCase();
    for (const [key, coords] of Object.entries(VERIFIED_STATION_COORDINATES)) {
      if (normalized.includes(key)) {
        return coords;
      }
    }
    return null;
  }

  private static getPreferredPollutants(eventType?: string): string[] {
    const isCombustion = eventType === "OPEN_WASTE_BURNING" || eventType === "INDUSTRIAL_SMOKE";
    const isDust = eventType === "DUST_EMISSION" || eventType === "CONSTRUCTION_DUST";
    const isTraffic = eventType === "TRAFFIC_SMOG";

    if (isCombustion) {
      return ["PM2.5", "PM10", "NO2"];
    } else if (isDust) {
      return ["PM10", "PM2.5"];
    } else if (isTraffic) {
      return ["NO2", "PM2.5"];
    } else {
      return ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"];
    }
  }

  public static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return parseFloat(median.toFixed(2));
  }

  public static getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private static getPrototypeContext(latitude: number, longitude: number): GroundMonitoring {
    return {
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
    };
  }
}
