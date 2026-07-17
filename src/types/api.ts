export enum EventType {
  OPEN_WASTE_BURNING = "OPEN_WASTE_BURNING",
  DUST_EMISSION = "DUST_EMISSION",
  TRAFFIC_SMOG = "TRAFFIC_SMOG",
  INDUSTRIAL_SMOKE = "INDUSTRIAL_SMOKE",
  CONSTRUCTION_DUST = "CONSTRUCTION_DUST",
  UNKNOWN = "UNKNOWN",
  SMOKE = "SMOKE",
  UNUSUAL_AIR = "UNUSUAL_AIR",
}

export enum Severity {
  LOW = "LOW",
  MODERATE = "MODERATE",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface VisualEvidence {
  smokeDetected: boolean;
  smokeDensity: "LOW" | "MODERATE" | "HIGH" | "NONE";
}

export interface GeminiAnalysisResult {
  eventType: EventType;
  pollutionTypes: string[];
  visualEvidence: VisualEvidence;
  severity: Severity;
  confidence: number;
  summary: string;
  evidence: string[];
  analysisSource?: "GEMINI_MULTIMODAL" | "DEMO_FALLBACK";
  selectedCategory?: string;
  categoryHint?: EventType | string;
  categoryLabel?: string;
  categoryAgreement?: "AGREES" | "CONFLICT" | "INSUFFICIENT_EVIDENCE";
  citizenSelectedCategory?: string;
  aiDetectedCategory?: EventType;
  categoryConflictReason?: string | null;
}

export interface GroundMonitoring {
  available: boolean;
  stationName?: string;
  distanceKm?: number;
  pollutant?: string;
  currentValue?: number;
  baseline: number | null;
  relativeAnomaly: number | null; // e.g. 0.72 means 72% above baseline
  anomalyScore?: number | null;
  anomalyAvailable: boolean;
  timestamp?: string;
  source: string;
  isPrototype?: boolean;
  error?: string;
}

export interface SatelliteContext {
  available: boolean;
  dataset?: string;
  observationWindow?: string;
  aerosolSignal?: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "NONE";
  contextScore?: number;
  source?: string;
  isPrototype?: boolean;
}

export interface WeatherContext {
  available: boolean;
  temperatureC?: number | null;
  relativeHumidity?: number | null;
  windSpeedKph?: number | null;
  windDirectionDegrees?: number | null;
  precipitationMm?: number | null;
  weatherCondition?: string | null;
  dispersionCondition: "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
  persistenceScore?: number | null;
  timestamp?: string | null;
  source: string;
  isPrototype?: boolean;
  error?: string;
  windSpeed?: number; // legacy for backward compatibility (m/s)
}

export interface ThermalContext {
  available: boolean;
  detectionFound: boolean;
  nearestDetectionDistanceKm?: number;
  detectionLatitude?: number;
  detectionLongitude?: number;
  acquisitionDate?: string;
  acquisitionTime?: string;
  satellite?: string;
  instrument?: string;
  confidence?: string;
  brightness?: number;
  fireRadiativePower?: number;
  dayNight?: string;
  source: string;
  isPrototype?: boolean;
  error?: string;
}

export interface EnvironmentalContext {
  groundMonitoring: GroundMonitoring;
  satelliteContext?: SatelliteContext;
  weatherContext: WeatherContext;
  thermalContext?: ThermalContext;
}

export interface CitizenReport {
  id: string;
  timestamp: string;
  text: string;
  language: "en" | "hi" | "mr";
  latitude: number;
  longitude: number;
  imageUrl?: string;
  isSeeded?: boolean;
  analysis?: GeminiAnalysisResult;
  selectedCategory?: string;
  categoryHint?: EventType | string;
  categoryLabel?: string;
  categoryAgreement?: "AGREES" | "CONFLICT" | "INSUFFICIENT_EVIDENCE";
  citizenSelectedCategory?: string;
  aiDetectedCategory?: EventType;
  categoryConflictReason?: string | null;
}

export interface FusionEvaluation {
  citizenReportCorrelation: number;
  visualEvidenceConfidence: number;
  groundMonitoringAnomaly: number | null;
  geospatialCorrelation: number;
  temporalCorrelation: number;
  atmosphericPersistence: number;
  finalScore: number; // H = 0.20C + 0.20V + 0.25S + 0.15G + 0.10T + 0.10M
  classification: "OBSERVATION" | "WATCH" | "PROBABLE HOTSPOT" | "HIGH-CONFIDENCE SIGNAL";
  availableEvidenceDimensions?: string[];
  unavailableEvidenceDimensions?: string[];
}

export interface ForecastPoint {
  time: string; // e.g. "NOW", "+3H", etc.
  value: number; // AQI equivalent value
}

export interface ForecastData {
  available?: boolean;
  disclosure?: string;
  points: ForecastPoint[];
  predictedSpikeTime?: string; // e.g. "+6 HOURS"
  predictedSpikeValue?: number; // e.g. 168
  spikeRisk?: number; // e.g. 87 for 87%
  contributors?: string[];
}

export enum DispatchStatus {
  AVAILABLE = "AVAILABLE",
  DISPATCHED = "DISPATCHED",
  EN_ROUTE = "EN_ROUTE",
  ON_SITE = "ON_SITE",
}

export interface DispatchState {
  available?: boolean;
  disclosure?: string;
  teamName?: string;
  status?: DispatchStatus;
  etaMinutes?: number;
  timestamp?: string;
}

export interface Hotspot {
  id: string;
  latitude: number;
  longitude: number;
  eventType: EventType;
  severity: Severity;
  signalStrength: number; // 0.0–1.0, derived from fusion finalScore (Evidence Convergence)
  address: string;
  timestamp: string;
  reportsCount: number;
  citizenReports: CitizenReport[];
  fusion: FusionEvaluation;
  context: EnvironmentalContext;
  forecast: ForecastData;
  dispatch?: DispatchState;
}
