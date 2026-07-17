# AEROGRID

### AI-powered hyperlocal pollution early-warning and municipal response intelligence.

---

## 📋 TEAM DECLARATION
* **Team Name**: Helix Orbit
* **Hackathon**: Build with AI: Code for Communities
* **Track**: Track 2 — CleanAir & Clear Streets
* **Pilot Region**: Pune, Maharashtra, India

---

## 🚨 PROBLEM
Traditional municipal air quality indices (AQI) rely on broad, sparse government telemetry stations. While valuable for broad regional context, they fail to catch highly localized, rapid street-level pollution hazards. Events like:
* Uncontrolled open municipal/plastic waste burning
* Suspended coarse dust columns from active metro and infrastructure excavations
* Heavy vehicle fleet exhaust pooling under low dispersion speed windows
* Industrial chimney emissions drifting into nearby residential margins

Because city authorities lack direct micro-scale situational visibility, these incidents escalate unhindered.

---

## 💡 SOLUTION
**AEROGRID** is a premium hyperlocal, real-time spatial intelligence platform designed for municipal command centres and civic responders. Rather than trying to rebuild full physical sensor networks, AEROGRID correlates citizens' multimodal evidence (text descriptions, audio recordings, camera observations) with existing public sensors and satellite atmospheric scans to detect, confirm, and prioritize local pollution event hot-spots.

---

## 🎯 CORE PRINCIPLE
> **“One report is an observation. Correlated independent evidence becomes a signal.”**

AEROGRID does not trigger municipal alerts or raise emergency alarms based on a single citizen complaint. Only when independent, multi-source environmental indicators line up spatially and temporally does the platform elevate an incident to a verified municipal signal.

---

## ⚙️ HOW AEROGRID WORKS

```
  CITIZEN REPORT
  [Text/Voice + Photo + GPS]
         │
         ▼
  MULTIMODAL GEMINI ENGINE
  [Analyzes smoke columns, density & flags events]
         │
         ▼
  ENVIRONMENTAL CONTEXT LAYER
  [Anomalies vs Hyperlocal AQI Ground Stations + Wind speed]
         │
         ▼
   HEURISTIC SIGNAL FUSION
   [Correlates multiple reports within 300m & 9min canonical window]
         │
         ▼
  PROTOTYPE 24H FORECAST
  [Projects immediate local AQI spikes and hazards]
         │
         ▼
  MUNICIPAL COMMAND DESK
  [Recommended Action Plan & Simulation Dispatch]
```

### 1. Gemini Multimodal Evidence Analysis
When a citizen reports an incident, our server-side Gemini 3.5 Flash model performs environmental evidence extraction. It looks at the submitted statement (interpreting English, Hindi, and Marathi transcriptions) alongside the uploaded image to flag visible pollution signatures. It handles visual checks (e.g., density of grey smoke) while respecting constraints (never estimating PM2.5 concentrations solely from a photograph).

### 2. Environmental Context Engine
For every report, the backend queries regional meteorological and geographic telemetry to calculate context anomalies. The active Pune prototype implements:
* **Citizen multimodal observations and GPS**: Sourced from direct citizen incident inputs, including localized coordinate boundaries.
* **Gemini multimodal evidence analysis**: Server-side extraction of visual combustion and pollution signatures from report text and images.
* **Geo-temporal citizen report correlation**: Spatiotemporal aggregation to verify nearby supporting observations.
* **NASA FIRMS Thermal Context** (Satellite Thermal Context — NASA FIRMS): Active thermal anomalies mapped in real-time from the Suomi NPP and NOAA satellites.
* **data.gov.in / CPCB Government AQ Context**: Localized particulate baseline and anomaly indexes from municipal ground monitoring.
* **Google Weather Dispersion Context**: Atmospheric ventilation factors, wind vector fields, and local pollution persistence indexes.
* **AEROGRID Signal Fusion**: Multi-evidence heuristic combination to calculate localized hazard levels and promote verified hotspots.

### 3. Heuristic Signal Fusion
AEROGRID's fusion engine calculates confirmation confidence based on:
$$H = 0.20 \cdot C + 0.20 \cdot V + 0.25 \cdot S + 0.15 \cdot G + 0.10 \cdot T + 0.10 \cdot M$$

Where:
* **C**: Citizen report correlation
* **V**: Gemini visual analysis confidence
* **S**: Ground sensor anomaly score
* **G**: Geospatial distance correlation (1.0 if within 250m; canonical Pune scenario 300m → 1.0; bands fall to 0.0 beyond 1000m)
* **T**: Temporal correlation (1.0 if within 15min; canonical Pune scenario 9min → 1.0; bands fall to 0.0 beyond 60min)
* **M**: Meteorological dispersion constraint (Low wind stagnant factor)

### 4. 24-Hour Prototype Forecast
Projects short-term pollution index variations. It alerts operators of imminent peak hazard spike windows (e.g., +6H PM2.5 spike risk) based on stagnant wind speeds and persistent reports.

### 5. Municipal Response Workflow
Once a hotspot crosses the `0.75` threshold, it is promoted to a **Verified Environmental Signal**. Commands are generated with action suggestions (Water Mist Deployment, Waste Fire Inspection, etc.) allowing simulated response dispatch.

---

## 🛡️ SYSTEM OPERATIONAL MODES & DATA DISCLOSURE

AEROGRID enforces a strict, robust architectural separation between its **Demo Prototype Sandbox Mode** and its production-defensible **Live Pilot Mode**. This guarantees absolute transparency and technical honesty before a professional hackathon jury.

### 🚥 Mode Comparison Matrix

| Operational Attribute | Demo Prototype Sandbox (`VITE_DEMO_MODE=true`) | Live Pilot Mode (`VITE_DEMO_MODE=false`) |
| :--- | :--- | :--- |
| **API Error Handling** | Graceful local mock fallbacks return calibrated data profiles for deterministic demonstrations. | Strict error propagation. Network timeouts, 403 Forbidden, and bad keys return explicit unavailable states (`available: false`). |
| **Missing API Keys** | Replaces missing environmental integrations with descriptive `PROTOTYPE CONTEXT` fallbacks. | Returns explicit error codes (e.g., `THERMAL_CONTEXT_UNAVAILABLE`, `GROUND_CONTEXT_UNAVAILABLE`) — never falsified evidence. |
| **Seeded Evidence Correlation** | Automatically positions supporting observations (e.g., `prototype_report_02` ~420m away) to test the correlation pipeline. | Completely disables synthetic citizen reports. All correlations are calculated exclusively on genuine independent live observations. |
| **Visual Attribution** | Interactive cards and visual badges are clearly marked with a yellow `DEMO ANALYSIS` or `PROTOTYPE CONTEXT` warning. | Displays high-integrity real API telemetry or transparently signals offline/unavailable sensor state to municipal dispatchers. |

* **Scientific Limitations Disclaimer**: The heuristic fusion formula and forecasting charts are illustrative calibration configurations. They are not scientifically validated and must be fine-tuned with localized continuous monitoring data for real-world deployments.
* **Data Sources**: Base coordinates represent Pune central districts. Satellite thermal context is derived from NASA FIRMS. Google Weather details are fetched via Google Maps Platform. Ground sensor context maps to official data.gov.in (CPCB) schemas.

### 🔬 Architectural Audit & Upgrades
The AEROGRID prototype has been updated with clean, server-side modular service architectures:
1. **Real Gemini Primary Path**:
   - The citizen report analysis is executed via a server-side route `/api/v1/reports/analyze` using the `@google/genai` SDK and the model `gemini-3.5-flash`.
   - Real Gemini analysis is marked with `"analysisSource": "GEMINI_MULTIMODAL"` in the API response and displays a green `GEMINI MULTIMODAL` badge.
   - Smart fallbacks are triggered only when the API key is missing or invalid, or when `DEMO_ONLY` is set to `true`, displaying a yellow `DEMO ANALYSIS` badge.
2. **Modular Ground & Satellite Services**:
   - Refactored environmental telemetry parsing into individual classes (`GroundMonitoringService` and `SatelliteContextService`).
   - Mock data sources have been explicitly renamed to `"PROTOTYPE_GROUND_CONTEXT"` and `"PROTOTYPE_SATELLITE_CONTEXT"` and flagged with `isPrototype: true`.
   - The UI correctly displays `PROTOTYPE CONTEXT` badges in the data cards to prevent implying that actual live CPCB or GEE networks are actively queried.
3. **Decoupled Signal Fusion Engine**:
   - Signal correlation calculations are isolated in `SignalFusionService.ts`, applying the designated weights formula and classification thresholds.
4. **NASA FIRMS Active-Fire Thermal Context Integration**:
   - **Dataset Sourced**: VIIRS 375 m active-fire thermal-anomaly product.
   - **Query Mechanism**: Computes a ±10 km (0.09-degree latitude/longitude) bounding box from the incident centroid, formatted as `min_lon,min_lat,max_lon,max_lat`. Searches within a 24-hour observation window.
   - **Heuristic Scoring Logic**: Calculates distance using the Haversine formula and weighs recency to produce a `thermalContextScore` (0.0 to 1.0). If FIRMS is unavailable or fails, it neutralizes (excludes) the score. If no nearby detection is found, it scores a low neutral baseline.
   - **Visual Indicators**: Displays custom satellite crosshairs on the municipal vector map with separate tooltips, 6-step signal-correlation scanners, and dedicated `REAL SATELLITE CONTEXT` or `PROTOTYPE SATELLITE CONTEXT` cards to ensure complete transparency.
   - **Supporting Role Disclosure**: Never claims independent street-level fire verification; satellite anomalies strictly act as secondary atmospheric supporting context.

 5. **Opt-in Durable Persistence (Firestore)**:
    - `persistence.ts` persists incidents and correlations to Google Firestore when `FIREBASE_SERVICE_ACCOUNT` is provided.
    - When the key is absent, the system transparently falls back to in-memory state (demo-safe, no crash) — providers and persistence always report availability explicitly (`available: false`).
 6. **Cloud Speech-to-Text & Web Speech Fallback**:
    - Server-side `/api/v1/speech-to-text` route uses Google Cloud STT (`GOOGLE_CLOUD_STT_KEY`) for audio transcription.
    - When the key is absent, the client uses the browser-native Web Speech API, keeping voice input fully functional for live demos without cloud credentials.
 7. **Progressive Web App (PWA)**:
    - Ships a `manifest.webmanifest`, app icon, and service worker (`sw.js`) for installable, offline-resilient municipal desk access.

### 🔬 Google Maps Platform Weather API & Atmospheric Dispersion Dynamics
    - **Service Sourced**: Current weather conditions via the Google Maps Platform Weather API `currentConditions:lookup` REST endpoint.
    - **Fields Extracted**: Real-time temperature, wind speed (kph), wind direction (degrees), relative humidity (%), precipitation (mm), weather conditions, and precise observation timestamps.
    - **Prototype Persistence Score Heuristic**: Maps wind speeds, relative humidity, and precipitation quantities using a bounded 0.0 to 1.0 scoring formula (higher score = stagnant air, higher pollution accumulation risk). Meaningful precipitation or high winds diminish local persistence.
    - **Scientific Disclosure**: This scoring logic is an illustrative prototype heuristic. AEROGRID does not currently implement CFD, chemical transport modelling, or a regulatory dispersion model. Weather observations provide supporting atmospheric context, and the persistence score is a prototype heuristic.
    - **Fallback Mechanism**: Previous weather indicators were static mock values. The system has been upgraded to support real API lookups. When `GOOGLE_WEATHER_API_KEY` is not provided, the interface explicitly displays a "PROTOTYPE CONTEXT" fallback with no real Google attribution.

### 🛰️ Remaining Implementation Gaps
- **Ground Monitoring Integration**: In production, the `GroundMonitoringService` will connect to CPCB's national air quality API using real station identifiers.
- **Durable Persistence**: Incident state is held in-memory by default (suitable for single-user pilot simulations). Opt-in Firestore persistence is available via `FIREBASE_SERVICE_ACCOUNT`; production scaling would migrate to a managed Cloud SQL/Firestore database.

## 🔮 FUTURE PRODUCTION INTEGRATIONS
* **Sentinel-5P Regional Aerosol Context via Google Earth Engine**:
  Sentinel-5P could provide regional absorbing-aerosol context for smoke and dust plume assessment.
  *Note: Sentinel-5P / Google Earth Engine is not part of the current active Pune prototype evidence flow and is not currently integrated.*

---

## 💻 TECHNOLOGY STACK
* **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4
* **AI Engine**: `@google/genai` (utilizing `gemini-3.5-flash` model)
* **Backend**: Express, Node.js running on Port 3000
* **Visuals**: Recharts (for clean forecast charts), Lucide Icons, Custom GIS SVG Vector Map
* **Deployment**: Configured for instant deployment on Google Cloud Run containers

---

## 🔧 LOCAL SETUP & RUNTIME

### Environment Variables
Configure a `.env` file at the root matching `.env.example`:
```env
GEMINI_API_KEY="YOUR_GOOGLE_AI_STUDIO_KEY"
VITE_DEMO_MODE="true"
```

### Run Development Server
To launch Express backend with hot-loaded Vite static assets:
```bash
npm run dev
```

### Build & Production Start
To build and bundle the full app for optimized Cloud Run deployments:
```bash
npm run build
npm start
```
The server binds to `0.0.0.0` on Port `3000` as required by the reverse proxy.
