import React from "react";
import { EnvironmentalContext as ContextType } from "../types/api";
import { Activity, Wind, AlertTriangle, Flame } from "lucide-react";

interface EnvironmentalContextProps {
  context: ContextType | null;
}

export default function EnvironmentalContext({ context }: EnvironmentalContextProps) {
  if (!context) {
    return (
      <div className="p-4 rounded-xl bg-[#101A28] border border-red-500/20 text-[#A2B1C4] space-y-3">
        <div className="flex items-center gap-2 text-[#FF5369]">
          <AlertTriangle className="w-5 h-5" />
          <h4 className="font-semibold text-white">Monitoring Context Offline</h4>
        </div>
        <p className="text-xs">
          Ground monitoring context temporarily unavailable. Recent satellite observations currently out of window.
        </p>
      </div>
    );
  }

  const { groundMonitoring, satelliteContext, weatherContext, thermalContext } = context;

  return (
    <div className="space-y-4">
      {/* Disclaimer Badge */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#162334] border border-slate-800 text-[11px] font-mono">
        <span className="text-[#A2B1C4]">DATA CLASSIFICATION:</span>
        {groundMonitoring && !groundMonitoring.isPrototype ? (
          <span className="text-[#31D697] font-semibold tracking-wider uppercase">
            GOVERNMENT AQ CONTEXT
          </span>
        ) : (
          <span className="text-[#FF8B1C] font-semibold tracking-wider uppercase">
            PROTOTYPE CONTEXT
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ground Monitoring Station Card */}
        <div className="p-4 rounded-xl bg-[#101A28] border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-[#A2B1C4] tracking-wider uppercase">
                {groundMonitoring && !groundMonitoring.isPrototype ? "GOVERNMENT AQ CONTEXT" : "Ground Air Context"}
              </span>
              <Activity className="w-4 h-4 text-[#00C9FF]" />
            </div>

            {groundMonitoring && groundMonitoring.available ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-white truncate" title={groundMonitoring.stationName}>
                  {groundMonitoring.stationName}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-[#00C9FF]">
                    {groundMonitoring.currentValue}
                  </span>
                  <span className="text-xs font-mono text-[#A2B1C4]">
                    µg/m³ {groundMonitoring.pollutant || "PM2.5"}
                  </span>
                </div>

                {groundMonitoring.distanceKm !== undefined && groundMonitoring.distanceKm !== null ? (
                  <div className="text-xs text-[#A2B1C4]">
                    Distance: <span className="font-mono text-white">{groundMonitoring.distanceKm} km</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">
                    Pune City Station Context
                  </div>
                )}

                {groundMonitoring.anomalyAvailable && groundMonitoring.relativeAnomaly !== null && groundMonitoring.baseline !== null ? (
                  <div className="text-[11px] px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[#FF5369] font-mono inline-block">
                    {groundMonitoring.relativeAnomaly >= 0 ? "+" : ""}
                    {Math.round(groundMonitoring.relativeAnomaly * 100)}% Anomaly vs Baseline ({groundMonitoring.baseline})
                  </div>
                ) : (
                  <div className="space-y-1.5 mt-2">
                    <div className="text-[10px] px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-amber-500 font-mono">
                      Recent baseline unavailable
                    </div>
                    <p className="text-[9px] text-slate-400 leading-normal">
                      Ground observation is shown as environmental context but is not included in anomaly scoring.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-xs text-slate-500 space-y-1">
                <p>Ground monitoring context temporarily unavailable</p>
                {groundMonitoring?.error && (
                  <span className="font-mono text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">
                    {groundMonitoring.error}
                  </span>
                )}
              </div>
            )}
          </div>
          {groundMonitoring && (
            <div className="text-[10px] font-mono text-slate-500 mt-4 pt-2 border-t border-slate-900 flex items-center justify-between gap-2 overflow-hidden">
              <span className="truncate" title={groundMonitoring.source}>Source: {groundMonitoring.source}</span>
              {groundMonitoring.isPrototype ? (
                <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded select-none shrink-0 font-sans tracking-wider">
                  PROTOTYPE
                </span>
              ) : (
                <span className="text-[9px] font-bold text-[#31D697] bg-[#31D697]/10 border border-[#31D697]/20 px-1.5 py-0.5 rounded select-none shrink-0 font-sans tracking-wider">
                  GOVERNMENT
                </span>
              )}
            </div>
          )}
        </div>

        {/* Weather Dispersion Conditions Card */}
        <div id="weather-dispersion-card" className="p-4 rounded-xl bg-[#101A28] border border-slate-800 flex flex-col justify-between">
          {!weatherContext || weatherContext.available === false ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-red-400 tracking-wider uppercase">WEATHER CONTEXT UNAVAILABLE</span>
                <Wind className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-xs text-[#A2B1C4] leading-relaxed">
                Incident assessment continues using available evidence.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-[#31D697] tracking-wider uppercase">
                  {weatherContext.isPrototype ? "PROTOTYPE CONTEXT" : "WEATHER DISPERSION CONTEXT"}
                </span>
                <Wind className="w-4 h-4 text-[#31D697]" />
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-white">
                  {weatherContext.isPrototype ? "Atmospheric Dispersion Fallback" : "REAL WEATHER CONTEXT"}
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-[#162334]/60 border border-slate-800">
                    <div className="text-[9px] text-slate-500 font-mono">WIND SPEED</div>
                    <div className="text-sm font-bold font-mono text-white">
                      {weatherContext.windSpeedKph !== null && weatherContext.windSpeedKph !== undefined 
                        ? `${weatherContext.windSpeedKph} kph`
                        : `${weatherContext.windSpeed || 1.8} m/s`}
                    </div>
                  </div>
                  
                  {weatherContext.windDirectionDegrees !== null && weatherContext.windDirectionDegrees !== undefined && (
                    <div className="p-2 rounded bg-[#162334]/60 border border-slate-800">
                      <div className="text-[9px] text-slate-500 font-mono">WIND DIRECTION</div>
                      <div className="text-sm font-bold font-mono text-white">
                        {weatherContext.windDirectionDegrees}°
                      </div>
                    </div>
                  )}

                  {weatherContext.relativeHumidity !== null && weatherContext.relativeHumidity !== undefined && (
                    <div className="p-2 rounded bg-[#162334]/60 border border-slate-800">
                      <div className="text-[9px] text-slate-500 font-mono">HUMIDITY</div>
                      <div className="text-sm font-bold font-mono text-white">
                        {weatherContext.relativeHumidity}%
                      </div>
                    </div>
                  )}

                  {weatherContext.precipitationMm !== null && weatherContext.precipitationMm !== undefined && (
                    <div className="p-2 rounded bg-[#162334]/60 border border-slate-800">
                      <div className="text-[9px] text-slate-500 font-mono">PRECIPITATION</div>
                      <div className="text-sm font-bold font-mono text-white">
                        {weatherContext.precipitationMm} mm
                      </div>
                    </div>
                  )}

                  <div className="p-2 rounded bg-[#162334]/60 border border-slate-800">
                    <div className="text-[9px] text-slate-500 font-mono">DISPERSION RATE</div>
                    <div className={`text-sm font-bold font-mono ${weatherContext.dispersionCondition === "LOW" ? "text-[#FF8B1C]" : "text-[#31D697]"}`}>
                      {weatherContext.dispersionCondition}
                    </div>
                  </div>

                  {weatherContext.persistenceScore !== null && weatherContext.persistenceScore !== undefined && (
                    <div className="p-2 rounded bg-[#162334]/60 border border-slate-800">
                      <div className="text-[9px] text-slate-500 font-mono">PERSISTENCE SCORE</div>
                      <div className="text-sm font-bold font-mono text-[#916BFF]">
                        {weatherContext.persistenceScore}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-[#A2B1C4] leading-relaxed">
                  “Weather context estimates local pollution persistence and dispersion conditions. It is supporting evidence and not a regulatory atmospheric dispersion model.”
                </p>
              </div>
            </div>
          )}
          {weatherContext && weatherContext.available && (
            <div className="text-[10px] font-mono text-slate-500 mt-4 pt-2 border-t border-slate-900">
              Source: {weatherContext.isPrototype ? "PROTOTYPE_WEATHER_CONTEXT" : "GOOGLE_WEATHER_API"}
            </div>
          )}
        </div>

        {/* NASA FIRMS Thermal Context Card */}
        <div className="p-4 rounded-xl bg-[#101A28] border border-slate-800 flex flex-col justify-between col-span-1">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-[#A2B1C4] tracking-wider uppercase">Active Thermal context</span>
              <Flame className="w-4 h-4 text-[#FF5369]" />
            </div>

            {thermalContext && thermalContext.available ? (
              thermalContext.detectionFound ? (
                <div className="space-y-2 text-xs">
                  <div className="font-bold text-[#FF5369] flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    NASA FIRMS anomaly detected
                  </div>
                  
                  {(() => {
                    const isDemo = import.meta.env.VITE_DEMO_MODE === "true" || thermalContext.isPrototype;
                    const distanceStr = thermalContext.nearestDetectionDistanceKm !== undefined && thermalContext.nearestDetectionDistanceKm !== null
                      ? `${thermalContext.nearestDetectionDistanceKm.toFixed(1)} km`
                      : (isDemo ? "1.8 km" : "DATA UNAVAILABLE");
                    const obsTimeStr = (thermalContext.acquisitionDate && thermalContext.acquisitionTime)
                      ? `${thermalContext.acquisitionDate} @ ${thermalContext.acquisitionTime}`
                      : (isDemo ? "Today @ 1045" : "DATA UNAVAILABLE");
                    const instStr = thermalContext.instrument || (isDemo ? "VIIRS" : "DATA UNAVAILABLE");
                    const confStr = thermalContext.confidence || (isDemo ? "nominal" : "DATA UNAVAILABLE");

                    return (
                      <div className="space-y-1 mt-2">
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-500">NEAREST:</span>
                          <span className="text-white font-bold">{distanceStr}</span>
                        </div>
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-500">OBS TIME:</span>
                          <span className="text-white font-bold">{obsTimeStr}</span>
                        </div>
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-500">INSTRUMENT:</span>
                          <span className="text-white font-bold">{instStr}</span>
                        </div>
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-500">CONFIDENCE:</span>
                          <span className="text-white font-bold uppercase">{confStr}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400">NASA FIRMS — No anomaly detected</div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Satellite non-detection does not rule out a local pollution event. Street-level combustion sources of small scale may be obscured.
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#FF5369] uppercase font-mono tracking-wide">THERMAL DATA UNAVAILABLE</div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Active thermal anomaly query unavailable for this environmental class or missing configuration.
                </p>
              </div>
            )}
          </div>
          
          <div className="text-[10px] font-mono text-slate-500 mt-4 pt-2 border-t border-slate-900">
            {thermalContext && thermalContext.available && thermalContext.detectionFound ? (
              <div className="flex justify-between items-center gap-2 overflow-hidden text-[9px]">
                <span className="truncate">Source: {thermalContext.source || "NASA FIRMS API"}</span>
                {thermalContext.isPrototype ? (
                  <span className="text-[8px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded select-none shrink-0 font-sans">
                    PROTOTYPE
                  </span>
                ) : (
                  <span className="text-[8px] font-bold text-[#31D697] bg-[#31D697]/10 border border-[#31D697]/20 px-1 py-0.5 rounded select-none shrink-0 font-sans">
                    REAL
                  </span>
                )}
              </div>
            ) : (
              <span>Source: NASA FIRMS Active Fire Database</span>
            )}
          </div>
        </div>
      </div>

      {/* Supporting context disclosure card */}
      <div className="p-4 bg-[#162334]/40 border border-slate-800 rounded-lg flex items-start gap-2.5">
        <div className="text-xs leading-relaxed text-[#A2B1C4] space-y-2">
          <p>
            <strong>About NASA FIRMS Supporting Thermal Context:</strong> The NASA Fire Information for Resource Management System (FIRMS) distributes Near Real-Time (NRT) active fire data within 3 hours of satellite observation. Sourced from the Suomi NPP and NOAA-20 satellites using the VIIRS (Visible Infrared Imaging Radiometer Suite) instrument at 375 m resolution.
          </p>
          <p className="text-[10px] text-slate-500 italic">
            Disclaimer: Satellite thermal-anomaly context serves as supporting evidence and does NOT independently verify a street-level fire. Scored using prototype heuristic logic intended for pilot calibration.
          </p>
        </div>
      </div>
    </div>
  );
}
