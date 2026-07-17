import React, { useState } from "react";
import { MapPin, ShieldAlert, Activity, Radio, Eye, Layers } from "lucide-react";
import { Hotspot, EventType, Severity } from "../types/api";

interface PuneMapProps {
  hotspots: Hotspot[];
  selectedHotspotId: string | null;
  onSelectHotspot: (id: string) => void;
}

export default function PuneMap({ hotspots, selectedHotspotId, onSelectHotspot }: PuneMapProps) {
  // Layer toggles
  const [layers, setLayers] = useState({
    citizenReports: true,
    groundStations: true,
    hotspots: true,
    thermalContext: true,
  });

  // Pune coordinates mapping helper
  // Bounds of our Pune Pilot Zone: 
  // Lat: 18.5150 to 18.5300 (roughly 1.6km height)
  // Lng: 73.8450 to 73.8650 (roughly 2.1km width)
  const mapWidth = 600;
  const mapHeight = 400;

  const latMin = 18.5120;
  const latMax = 18.5280;
  const lngMin = 73.8430;
  const lngMax = 73.8630;

  const getCoordinates = (lat: number, lng: number) => {
    // Project GPS decimal coordinates to SVG coordinate space
    const x = ((lng - lngMin) / (lngMax - lngMin)) * mapWidth;
    // Invert Y because SVG coordinates start from top-left
    const y = mapHeight - (((lat - latMin) / (latMax - latMin)) * mapHeight);
    return { x, y };
  };

  // Fixed Pune landmarks for a rich geographic feel
  const landmarks = [
    { name: "Shivajinagar Market", lat: 18.5235, lng: 73.8525 },
    { name: "Pune Central Mall", lat: 18.5185, lng: 73.8480 },
    { name: "Savitribai Phule University", lat: 18.5270, lng: 73.8440 },
    { name: "Mutha Riverbank", lat: 18.5255, lng: 73.8580 },
    { name: "Pune Railway Station", lat: 18.5190, lng: 73.8610 },
  ];

  const STATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
    "shivajinagar": { lat: 18.5304, lng: 73.8485 },
    "karve road": { lat: 18.5028, lng: 73.8291 },
    "bhosari": { lat: 18.6225, lng: 73.8425 },
    "hadapsar": { lat: 18.5050, lng: 73.9248 },
    "pimpri": { lat: 18.6247, lng: 73.8011 },
    "katraj": { lat: 18.4575, lng: 73.8550 },
    "alandi": { lat: 18.6750, lng: 73.8872 },
    "lohegaon": { lat: 18.5800, lng: 73.9200 },
    "solapur road": { lat: 18.5030, lng: 73.8760 },
    "nal stop": { lat: 18.5075, lng: 73.8295 }
  };

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  // Ground Stations to render dynamically
  const stationsToRender: Array<{ name: string; lat: number; lng: number; aqi: number }> = [];

  if (isDemoMode) {
    // In DEMO MODE, the hardcoded Shivajinagar station marker may be shown as a prototype fallback
    stationsToRender.push({
      name: "Shivajinagar CPCB Station",
      lat: 18.5204,
      lng: 73.8567,
      aqi: 117
    });
  } else {
    // In LIVE MODE:
    // - Render dynamic stations returned by the active hotspot if they have valid coordinates
    const activeHotspot = hotspots.find((h) => h.id === selectedHotspotId) || hotspots[0];
    const gm = activeHotspot?.context?.groundMonitoring;
    if (gm && gm.available && gm.stationName && gm.currentValue !== undefined && gm.currentValue !== null) {
      const normalized = gm.stationName.toLowerCase();
      let foundCoords = null;
      for (const [key, coords] of Object.entries(STATION_COORDINATES)) {
        if (normalized.includes(key)) {
          foundCoords = coords;
          break;
        }
      }
      if (foundCoords) {
        stationsToRender.push({
          name: gm.stationName,
          lat: foundCoords.lat,
          lng: foundCoords.lng,
          aqi: gm.currentValue
        });
      }
    }
  }

  const hasThermalContext = hotspots.some((h) => {
    const tc = h.context?.thermalContext;
    return tc && tc.available && tc.detectionFound === true && typeof tc.detectionLatitude === "number" && typeof tc.detectionLongitude === "number";
  });

  const handleToggleLayer = (layerName: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [layerName]: !prev[layerName] }));
  };

  return (
    <div className="bg-[#101A28] border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full">
      {/* Map Control Header */}
      <div className="px-4 py-3 bg-[#162334] border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#00C9FF]" />
          <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            HYPERLOCAL GEOSPATIAL VECTOR MAP (PUNE PILOT)
          </h4>
        </div>
        
        {/* Layer Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleToggleLayer("citizenReports")}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition-all duration-200 cursor-pointer ${
              layers.citizenReports 
                ? "bg-[#00C9FF]/15 text-[#00C9FF] border-[#00C9FF]/40" 
                : "bg-transparent text-slate-500 border-slate-800"
            }`}
          >
            ● CITIZEN REPORTS
          </button>
          <button
            onClick={() => handleToggleLayer("groundStations")}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition-all duration-200 cursor-pointer ${
              layers.groundStations 
                ? "bg-[#31D697]/15 text-[#31D697] border-[#31D697]/40" 
                : "bg-transparent text-slate-500 border-slate-800"
            }`}
          >
            ● GROUND STATIONS
          </button>
          <button
            onClick={() => handleToggleLayer("hotspots")}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition-all duration-200 cursor-pointer ${
              layers.hotspots 
                ? "bg-[#FF5369]/15 text-[#FF5369] border-[#FF5369]/40" 
                : "bg-transparent text-slate-500 border-slate-800"
            }`}
          >
            ● HOTSPOTS
          </button>
          {hasThermalContext && (
            <button
              onClick={() => handleToggleLayer("thermalContext")}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition-all duration-200 cursor-pointer ${
                layers.thermalContext 
                  ? "bg-[#FF5369]/15 text-[#FF5369] border-[#FF5369]/40" 
                  : "bg-transparent text-slate-500 border-slate-800"
              }`}
            >
              ● THERMAL CONTEXT
            </button>
          )}
        </div>
      </div>

      {/* Geospatial Canvas Area */}
      <div className="relative flex-grow bg-[#080E18] min-h-[350px] overflow-hidden">
        {/* Grid Overlay background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#162334_1px,transparent_1px),linear-gradient(to_bottom,#162334_1px,transparent_1px)] bg-[size:30px_30px] opacity-15" />

        {/* Thermal Context radial aura (precise dynamic position) */}
        {hasThermalContext && layers.thermalContext && hotspots.map((h) => {
          const tc = h.context?.thermalContext;
          if (!tc || !tc.available || !tc.detectionFound || !tc.detectionLatitude || !tc.detectionLongitude) {
            return null;
          }
          const { x, y } = getCoordinates(tc.detectionLatitude, tc.detectionLongitude);
          // Scale SVG coordinates to percentage for absolute positioning
          const pctX = (x / mapWidth) * 100;
          const pctY = (y / mapHeight) * 100;
          return (
            <div 
              key={`aura-${h.id}`}
              className="absolute bg-gradient-radial from-[#FF5369]/20 via-[#FF5369]/5 to-transparent rounded-full filter blur-xl animate-pulse pointer-events-none"
              style={{
                left: `${pctX}%`,
                top: `${pctY}%`,
                width: "120px",
                height: "120px",
                transform: "translate(-50%, -50%)"
              }}
            />
          );
        })}

        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full relative z-10 select-none">
          {/* Mutha Riverbank Path representation */}
          <path
            d="M 0,320 C 150,280 300,180 600,120"
            fill="none"
            stroke="#1a3554"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.3"
          />
          <text x={400} y={150} fill="#1a3554" fontSize="10" fontFamily="monospace" opacity="0.6">MUTHA RIVER</text>

          {/* Landmarks labels */}
          {landmarks.map((l, index) => {
            const { x, y } = getCoordinates(l.lat, l.lng);
            return (
              <g key={index} opacity="0.35">
                <circle cx={x} cy={y} r="2" fill="#A2B1C4" />
                <text
                  x={x + 5}
                  y={y + 3}
                  fontSize="8"
                  fill="#A2B1C4"
                  fontFamily="monospace"
                >
                  {l.name.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Render Ground Monitoring Station */}
          {layers.groundStations && stationsToRender.map((s, idx) => {
            const { x, y } = getCoordinates(s.lat, s.lng);
            return (
              <g key={idx}>
                {/* Station Circle */}
                <circle cx={x} cy={y} r="15" fill="none" stroke="#31D697" strokeWidth="1" strokeDasharray="2,2" />
                <circle cx={x} cy={y} r="5" fill="#31D697" opacity="0.8" />
                <text
                  x={x + 10}
                  y={y - 5}
                  fontSize="8"
                  fontWeight="bold"
                  fill="#31D697"
                  fontFamily="monospace"
                >
                  AQM STATION ({s.aqi} µg/m³)
                </text>
              </g>
            );
          })}

          {/* Render Active Hotspots / Signals */}
          {layers.hotspots && hotspots.map((h) => {
            const { x, y } = getCoordinates(h.latitude, h.longitude);
            const isSelected = selectedHotspotId === h.id;
            
            // Map colors according to severity
            let color = "#FF5369"; // RED for CRITICAL
            let glowColor = "rgba(255, 83, 105, 0.4)";
            if (h.severity === Severity.MODERATE) {
              color = "#FF8B1C"; // ORANGE
              glowColor = "rgba(255, 139, 28, 0.4)";
            }

            return (
              <g 
                key={h.id} 
                className="cursor-pointer" 
                onClick={() => onSelectHotspot(h.id)}
              >
                {/* Heat aura range */}
                <circle 
                  cx={x} 
                  cy={y} 
                  r={isSelected ? "45" : "30"} 
                  fill={color} 
                  fillOpacity="0.08" 
                  className="transition-all duration-300"
                />
                
                {/* Ping rings */}
                <circle 
                  cx={x} 
                  cy={y} 
                  r={isSelected ? "55" : "38"} 
                  fill="none" 
                  stroke={color} 
                  strokeWidth="0.5" 
                  strokeOpacity="0.4"
                  className="animate-ping"
                />

                {/* Main Marker circle */}
                <circle 
                  cx={x} 
                  cy={y} 
                  r={isSelected ? "12" : "8"} 
                  fill="#080E18" 
                  stroke={color} 
                  strokeWidth="2.5"
                  className="transition-all duration-300"
                />

                <circle cx={x} cy={y} r="3" fill={color} />

                {/* Tooltip Overlay above hotspot */}
                <g transform={`translate(${x}, ${y - 18})`}>
                  <rect 
                    x="-65" 
                    y="-22" 
                    width="130" 
                    height="18" 
                    rx="3" 
                    fill="#162334" 
                    stroke={color} 
                    strokeWidth="1"
                  />
                  <text 
                    y="-10" 
                    textAnchor="middle" 
                    fill="white" 
                    fontSize="7" 
                    fontWeight="bold" 
                    fontFamily="monospace"
                  >
                    {h.eventType.replace("_", " ")} ({Math.round(h.signalStrength * 100)}%)
                  </text>
                </g>
              </g>
            );
          })}

          {/* Render Satellite Thermal Detection Markers */}
          {hasThermalContext && layers.thermalContext && hotspots.map((h) => {
            const tc = h.context?.thermalContext;
            if (!tc || !tc.available || !tc.detectionFound || !tc.detectionLatitude || !tc.detectionLongitude) {
              return null;
            }

            const { x, y } = getCoordinates(tc.detectionLatitude, tc.detectionLongitude);
            
            return (
              <g key={`thermal-${h.id}`} className="cursor-pointer group">
                {/* Outer satellite radar sweep or crosshair */}
                <circle 
                  cx={x} 
                  cy={y} 
                  r="18" 
                  fill="none" 
                  stroke="#FF5369" 
                  strokeWidth="0.75" 
                  strokeDasharray="3,2"
                  opacity="0.7"
                  className="animate-[spin_15s_linear_infinite]"
                />
                
                {/* Horizontal & Vertical Crosshair Lines */}
                <line x1={x - 6} y1={y} x2={x + 6} y2={y} stroke="#FF5369" strokeWidth="1" opacity="0.9" />
                <line x1={x} y1={y - 6} x2={x} y2={y + 6} stroke="#FF5369" strokeWidth="1" opacity="0.9" />

                {/* Main Marker center */}
                <circle 
                  cx={x} 
                  cy={y} 
                  r="4" 
                  fill="#FF5369" 
                  stroke="#080E18" 
                  strokeWidth="1.5"
                />

                {/* Satellite Label tooltip (visible on hover) */}
                <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" transform={`translate(${x}, ${y - 12})`}>
                  <rect 
                    x="-75" 
                    y="-34" 
                    width="150" 
                    height="30" 
                    rx="4" 
                    fill="#080E18" 
                    stroke="#FF5369" 
                    strokeWidth="1.5"
                  />
                  <text 
                    y="-22" 
                    textAnchor="middle" 
                    fill="#FF5369" 
                    fontSize="7" 
                    fontWeight="extrabold" 
                    fontFamily="monospace"
                  >
                    🛰️ THERMAL CONTEXT
                  </text>
                  {(() => {
                    const isDemo = import.meta.env.VITE_DEMO_MODE === "true" || tc.isPrototype;
                    const distStr = tc.nearestDetectionDistanceKm !== undefined && tc.nearestDetectionDistanceKm !== null
                      ? `${tc.nearestDetectionDistanceKm.toFixed(1)} km`
                      : (isDemo ? "1.8 km" : "DATA UNAVAILABLE");
                    const timeStr = (tc.acquisitionDate && tc.acquisitionTime)
                      ? `${tc.acquisitionDate} @ ${tc.acquisitionTime}`
                      : (isDemo ? "Today @ 1045" : "DATA UNAVAILABLE");
                    const instStr = tc.instrument || (isDemo ? "VIIRS" : "DATA UNAVAILABLE");

                    return (
                      <>
                        <text 
                          y="-14" 
                          textAnchor="middle" 
                          fill="#A2B1C4" 
                          fontSize="6" 
                          fontFamily="monospace"
                        >
                          NASA FIRMS ({instStr}) • Dist: {distStr}
                        </text>
                        <text 
                          y="-6" 
                          textAnchor="middle" 
                          fill="#A2B1C4" 
                          fontSize="5" 
                          fontFamily="monospace"
                        >
                          Acquired: {timeStr}
                        </text>
                      </>
                    );
                  })()}
                </g>
              </g>
            );
          })}

          {/* Render individual report nodes linked to the hotspot */}
          {layers.citizenReports && hotspots.map((h) => {
            return h.citizenReports.map((report) => {
              const { x, y } = getCoordinates(report.latitude, report.longitude);
              const color = report.isSeeded ? "#FF8B1C" : "#00C9FF"; // Seeded Orange, Live Cyan
              
              return (
                <g key={report.id}>
                  <circle 
                    cx={x} 
                    cy={y} 
                    r="4" 
                    fill={color} 
                    stroke="#080E18" 
                    strokeWidth="1"
                  />
                  <line 
                    x1={x} 
                    y1={y} 
                    x2={getCoordinates(h.latitude, h.longitude).x} 
                    y2={getCoordinates(h.latitude, h.longitude).y} 
                    stroke={color} 
                    strokeWidth="0.5" 
                    strokeDasharray="2,2" 
                    opacity="0.5"
                  />
                  <text 
                    x={x + 6} 
                    y={y + 3} 
                    fill={color} 
                    fontSize="6" 
                    fontFamily="monospace"
                  >
                    {report.isSeeded ? "SEEDED OBS" : "LIVE REPORT"}
                  </text>
                </g>
              );
            });
          })}
        </svg>

        {/* Compass & Pilot Scale Indicators */}
        <div className="absolute bottom-3 right-3 bg-[#101A28]/90 border border-slate-800 rounded p-2.5 space-y-1 font-mono text-[9px]">
          <div className="text-white font-bold">PUNE PILOT REGION</div>
          <div className="text-[#A2B1C4]">Coordinates: 18.5204° N, 73.8567° E</div>
          <div className="text-[#00C9FF]">Boundary: Shivajinagar Central Zone</div>
          <div className="text-slate-500">Vector Scale: 1:350m Grid</div>
        </div>

        {/* Map Legend (Bottom Left) */}
        <div className="absolute bottom-3 left-3 bg-[#101A28]/90 border border-slate-800 rounded p-2.5 space-y-1.5 text-[9px] font-mono z-20">
          <div className="text-[#A2B1C4] font-bold uppercase tracking-wider mb-1">Map Legend</div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00C9FF] inline-block" />
            <span className="text-white">Live Citizen Observation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF8B1C] inline-block" />
            <span className="text-white">Prototype Supporting Obs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#31D697] inline-block" />
            <span className="text-white">Ground AQM Station</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5369] inline-block" />
            <span className="text-white">High-Confidence Environmental Signal</span>
          </div>
          {hasThermalContext && layers.thermalContext && (
            <div className="flex items-center gap-1.5 border-t border-slate-800 pt-1.5 mt-0.5">
              <span className="text-[#FF5369] font-bold text-[11px] leading-none">⌖</span>
              <span className="text-[#FF5369] font-bold">Thermal Context</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
