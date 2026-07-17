import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

/**
 * Optional Firestore persistence layer for AEROGRID citizen observations and signals.
 *
 * DESIGN PRINCIPLE: Persistence is OPT-IN and degrades gracefully.
 *  - If FIREBASE_SERVICE_ACCOUNT (JSON, or path to JSON) is provided, reports and hotspots
 *    are persisted to Firestore and shared across instances/devices.
 *  - If it is absent, the system operates in-memory only (prototype behavior) and the demo
 *    continues to function. No crash, no fabricated failure.
 *
 * This keeps the in-person Demo Day bulletproof: the app works with OR without credentials.
 */

let db: Firestore | null = null;
let initialized = false;

function resolveServiceAccount(): any | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    // Accept inline JSON or a file path
    if (raw.trim().startsWith("{")) return JSON.parse(raw);
    const fs = require("fs");
    if (fs.existsSync(raw)) return JSON.parse(fs.readFileSync(raw, "utf8"));
  } catch (e) {
    console.warn("[persistence] Failed to parse FIREBASE_SERVICE_ACCOUNT:", (e as Error).message);
  }
  return null;
}

function ensureInit(): Firestore | null {
  if (initialized) return db;
  initialized = true;

  const sa = resolveServiceAccount();
  if (!sa) {
    console.log("[persistence] No FIREBASE_SERVICE_ACCOUNT configured — using in-memory store (demo-safe).");
    return null;
  }

  try {
    let app: App;
    if (getApps().length === 0) {
      app = initializeApp({ credential: cert(sa) });
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    console.log("[persistence] Firestore connected — reports and hotspots will persist.");
  } catch (e) {
    console.warn("[persistence] Firestore init failed; falling back to in-memory:", (e as Error).message);
    db = null;
  }
  return db;
}

export const PERSISTENCE_COLLECTIONS = {
  reports: "citizen_reports",
  hotspots: "signals",
} as const;

/** True when Firestore persistence is active. */
export function isPersistenceEnabled(): boolean {
  return ensureInit() !== null;
}

/** Persist a citizen report. No-op return contract: always resolves. */
export async function saveReport(report: any): Promise<void> {
  const firestore = ensureInit();
  if (!firestore) return;
  try {
    await firestore.collection(PERSISTENCE_COLLECTIONS.reports).doc(report.id).set({
      ...report,
      _persistedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[persistence] saveReport failed:", (e as Error).message);
  }
}

/** Persist a promoted signal/hotspot. */
export async function saveHotspot(hotspot: any): Promise<void> {
  const firestore = ensureInit();
  if (!firestore) return;
  try {
    await firestore.collection(PERSISTENCE_COLLECTIONS.hotspots).doc(hotspot.id).set({
      ...hotspot,
      _persistedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[persistence] saveHotspot failed:", (e as Error).message);
  }
}

/**
 * Load persisted reports/hotspots into the in-memory store on cold start.
 * Returns { reports, hotspots } or empty arrays when persistence is disabled.
 */
export async function loadPersistedState(): Promise<{ reports: any[]; hotspots: any[] }> {
  const firestore = ensureInit();
  if (!firestore) return { reports: [], hotspots: [] };
  try {
    const [repSnap, hotSnap] = await Promise.all([
      firestore.collection(PERSISTENCE_COLLECTIONS.reports).limit(1000).get(),
      firestore.collection(PERSISTENCE_COLLECTIONS.hotspots).limit(100).get(),
    ]);
    const reports = repSnap.docs.map((d) => d.data());
    const hotspots = hotSnap.docs.map((d) => d.data());
    console.log(`[persistence] Loaded ${reports.length} reports, ${hotspots.length} signals from Firestore.`);
    return { reports, hotspots };
  } catch (e) {
    console.warn("[persistence] loadPersistedState failed:", (e as Error).message);
    return { reports: [], hotspots: [] };
  }
}
