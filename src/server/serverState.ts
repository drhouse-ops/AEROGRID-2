/**
 * Shared in-memory state and seed data for the AEROGRID API server.
 *
 * NOTE: This is prototype persistence only (resets on restart). Persistence to a
 * real datastore (Firestore) is tracked under Phase B of the Demo Day hardening plan.
 */

export interface SeededReport {
  id: string;
  timestamp: string;
  text: string;
  language: "en" | "hi" | "mr";
  latitude: number;
  longitude: number;
  isSeeded: boolean;
  imageUrl?: string;
  analysis: {
    eventType: string;
    pollutionTypes: string[];
    visualEvidence: { smokeDetected: boolean; smokeDensity: "LOW" | "MODERATE" | "HIGH" | "NONE" };
    severity: string;
    confidence: number;
    summary: string;
    evidence: string[];
    analysisSource: string;
  };
}

export const SEEDED_REPORT_ID = "prototype_report_02";

export const SEEDED_REPORT: SeededReport = {
  id: SEEDED_REPORT_ID,
  timestamp: new Date(Date.now() - 9 * 60000).toISOString(), // 9 mins ago
  text: "High level of waste burning spotted near the market area. Huge plumes of plastic smoke.",
  language: "mr",
  latitude: 18.5238, // Pune approx 420m away from 18.5204, 73.8567
  longitude: 73.8545,
  isSeeded: true,
  imageUrl: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?auto=format&fit=crop&q=80&w=500",
  analysis: {
    eventType: "OPEN_WASTE_BURNING",
    pollutionTypes: ["SMOKE", "TOXIC_GAS"],
    visualEvidence: {
      smokeDetected: true,
      smokeDensity: "HIGH",
    },
    severity: "HIGH",
    confidence: 0.91,
    summary: "Dense black smoke with visible ground debris is highly consistent with unmanaged municipal waste combustion.",
    evidence: [
      "Dense grey/black smoke columns visible in photo",
      "Debris fire signature in close proximity to residential margins",
    ],
    analysisSource: "GEMINI_MULTIMODAL",
  },
};

// In-memory "database" for prototype persistence.
export const serverState = {
  liveReports: [] as any[],
  hotspots: [] as any[],
};

// Lightweight event bus for the live signal stream (Server-Sent Events).
// Consumers (the municipal desk) subscribe to real-time report / hotspot events.
type SignalStreamEvent =
  | { type: "report_received"; report: any; at: string }
  | { type: "hotspot_promoted"; hotspot: any; at: string }
  | { type: "hotspot_dispatched"; hotspotId: string; dispatch: any; at: string }
  | { type: "hotspot_resolved"; hotspotId: string; resolution: any; at: string }
  | { type: "hotspot_dismissed"; hotspotId: string; reason: string; at: string };

type Listener = (event: SignalStreamEvent) => void;

const signalStreamListeners = new Set<Listener>();

export function emitSignalStreamEvent(event: SignalStreamEvent): void {
  for (const listener of signalStreamListeners) {
    try {
      listener(event);
    } catch (e) {
      console.warn("[signalStream] listener error:", (e as Error).message);
    }
  }
}

export function subscribeSignalStream(listener: Listener): () => void {
  signalStreamListeners.add(listener);
  return () => {
    signalStreamListeners.delete(listener);
  };
}

export function resetDatabase(): void {
  serverState.liveReports = [];
  serverState.hotspots = [];
  console.log("Database state reset successfully.");
}

/**
 * Persist a newly received citizen report (no-op when Firestore is disabled).
 */
export async function persistReport(report: any): Promise<void> {
  const { saveReport } = await import("./persistence");
  await saveReport(report);
}

/**
 * Persist a promoted signal/hotspot (no-op when Firestore is disabled).
 */
export async function persistHotspot(hotspot: any): Promise<void> {
  const { saveHotspot } = await import("./persistence");
  await saveHotspot(hotspot);
}

/**
 * Load any persisted state from Firestore into the in-memory store on cold start.
 * Safe to call even when persistence is disabled. Call once before serving traffic.
 */
export async function hydrateFromPersistence(): Promise<void> {
  const { loadPersistedState } = await import("./persistence");
  try {
    const { reports, hotspots } = await loadPersistedState();
    if (reports.length > 0) serverState.liveReports = reports;
    if (hotspots.length > 0) serverState.hotspots = hotspots;
  } catch (e) {
    console.warn("[serverState] hydrateFromPersistence failed:", (e as Error).message);
  }
}
