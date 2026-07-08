import { CitizenReport, EventType, Severity, EnvironmentalContext, ForecastData } from "../types/api";

export const DEMO_LOCATION = {
  latitude: 18.5204,
  longitude: 73.8567,
  label: "Pune Central Pilot Zone",
};

// Check if point is inside Pune pilot boundary
export function isWithinPuneBoundary(lat: number, lng: number): boolean {
  // Simple latitude/longitude bounding box check for Pune
  // Pune lies roughly between 18.40 and 18.65 Latitude, and 73.70 and 74.00 Longitude.
  return lat >= 18.40 && lat <= 18.65 && lng >= 73.70 && lng <= 74.00;
}

export const SEEDED_SUPPORTING_REPORT: CitizenReport = {
  id: "prototype_report_02",
  timestamp: new Date(Date.now() - 7 * 60000).toISOString(), // 7 minutes ago
  text: "High level of waste burning spotted near the market area. Huge plumes of plastic smoke.",
  language: "en",
  latitude: 18.5238, // ~420m away from 18.5204, 73.8567
  longitude: 73.8545,
  isSeeded: true,
  imageUrl: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?auto=format&fit=crop&q=80&w=500", // Representative image
  selectedCategory: "burning",
  categoryHint: EventType.OPEN_WASTE_BURNING,
  categoryLabel: "GARBAGE OR WASTE BURNING",
  categoryAgreement: "AGREES",
  citizenSelectedCategory: "burning",
  aiDetectedCategory: EventType.OPEN_WASTE_BURNING,
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
      "Dense grey/black smoke columns visible",
      "Debris fire signature in close proximity to residential margins",
    ],
    selectedCategory: "burning",
    categoryHint: EventType.OPEN_WASTE_BURNING,
    categoryLabel: "GARBAGE OR WASTE BURNING",
    categoryAgreement: "AGREES",
    citizenSelectedCategory: "burning",
    aiDetectedCategory: EventType.OPEN_WASTE_BURNING,
  },
};

export const FALLBACK_ENVIRONMENTAL_CONTEXT: EnvironmentalContext = {
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
    source: "Government AQ monitoring context",
  },
  satelliteContext: {
    available: false,
  },
  weatherContext: {
    available: true,
    temperatureC: 27,
    relativeHumidity: 65,
    windSpeedKph: 6.48,
    windSpeed: 1.8,
    windDirectionDegrees: 180,
    precipitationMm: 0,
    weatherCondition: "Clear",
    persistenceScore: 0.78,
    timestamp: "2026-07-05T12:00:00Z",
    source: "PROTOTYPE_WEATHER_CONTEXT",
    isPrototype: true,
    dispersionCondition: "LOW",
  },
};

export const FALLBACK_FORECAST: ForecastData = {
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
    "Low wind dispersion (current speed 1.8 m/s)",
    "Persistent local smoke observations (multiple correlated reports)",
    "High environmental signal confidence index",
  ],
};
