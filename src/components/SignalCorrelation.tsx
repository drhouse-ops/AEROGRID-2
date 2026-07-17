import React, { useEffect, useState } from "react";
import { Activity, MapPin, Eye, Sparkles, Wind, Flame, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";
import { Hotspot } from "../types/api";
import { generatePromotionExplanations } from "../utils/correlationUtils";

interface SignalCorrelationProps {
  score: number | null;
  onComplete?: () => void;
  autoProgress?: boolean;
  hotspot?: Hotspot | null;
}

export default function SignalCorrelation({
  score,
  onComplete,
  autoProgress = true,
  hotspot
}: SignalCorrelationProps) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isDone, setIsDone] = useState<boolean>(false);

  useEffect(() => {
    if (!autoProgress) {
      setActiveStep(6);
      setIsDone(true);
      return;
    }

    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev < 6) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setIsDone(true);
          if (onComplete) {
            onComplete();
          }
          return prev;
        }
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [autoProgress, onComplete]);

  // Derived evidence values
  const reportCount = hotspot?.citizenReports?.length || hotspot?.reportsCount || 0;
  const fusionAny = hotspot?.fusion as any;
  const liveReportCount = fusionAny?.liveReportCount ?? (hotspot?.citizenReports?.filter((r: any) => !r.isSeeded).length || 1);
  const seededReportCount = fusionAny?.seededReportCount ?? (hotspot?.citizenReports?.filter((r: any) => !!r.isSeeded).length || 0);
  
  const latestReport = hotspot?.citizenReports?.[0];
  const analysis = latestReport?.analysis;

  const citizenCategory = latestReport?.citizenSelectedCategory || latestReport?.selectedCategory || latestReport?.categoryLabel || analysis?.citizenSelectedCategory || analysis?.selectedCategory;
  const aiDetectedCategory = latestReport?.aiDetectedCategory || analysis?.aiDetectedCategory || analysis?.eventType;
  const categoryAgreement = latestReport?.categoryAgreement || analysis?.categoryAgreement;
  const categoryConflictReason = latestReport?.categoryConflictReason || analysis?.categoryConflictReason;
  const aiConfidence = analysis?.confidence;

  const tc = hotspot?.context?.thermalContext;
  const gm = hotspot?.context?.groundMonitoring;
  const wc = hotspot?.context?.weatherContext;

  // Filter out any empty, undefined, or null values for Google Weather display
  const weatherFields = [];
  if (wc && wc.available) {
    if (wc.windSpeedKph !== null && wc.windSpeedKph !== undefined) {
      weatherFields.push({ label: "Wind Speed", value: `${wc.windSpeedKph} kph` });
    } else if (wc.windSpeed !== null && wc.windSpeed !== undefined) {
      weatherFields.push({ label: "Wind Speed", value: `${wc.windSpeed} m/s` });
    }
    if (wc.precipitationMm !== null && wc.precipitationMm !== undefined) {
      weatherFields.push({ label: "Precipitation", value: `${wc.precipitationMm} mm` });
    }
    if (wc.weatherCondition) {
      weatherFields.push({ label: "Conditions", value: wc.weatherCondition });
    }
    if (wc.dispersionCondition) {
      weatherFields.push({ label: "Atmospheric Dispersion", value: wc.dispersionCondition });
    }
    if (wc.persistenceScore !== null && wc.persistenceScore !== undefined) {
      weatherFields.push({ label: "Persistence Score", value: wc.persistenceScore.toFixed(2) });
    }
  }

  // Get status explanations for "WHY THIS SIGNAL WAS PROMOTED"
  const explanations = generatePromotionExplanations(hotspot);

  return (
    <div id="signal-correlation-container" className="p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-6 text-white">
      {/* 4. NEW SIGNAL CORRELATION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h3 id="signal-correlation-title" className="text-sm font-mono text-[#00C9FF] tracking-wider uppercase font-bold">
            SIGNAL CORRELATION
          </h3>
          <p className="text-xs text-[#A2B1C4] mt-1">
            Why AEROGRID considered these observations an emerging signal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded bg-[#162334] border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-wider">
              Signal Status
            </span>
            <span className="text-xs font-bold text-[#FF8B1C] font-mono">
              {hotspot?.fusion?.classification || "EMERGING WATCH"}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded bg-[#162334] border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-wider">
              SIGNAL STRENGTH
            </span>
            {score !== undefined && score !== null ? (
              <span className="text-xs font-bold text-[#00C9FF] font-mono">
                {(score * 100).toFixed(0)}%
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-400 font-mono">
                AWAITING FUSION RESULT
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Network Processing / Progress bar */}
      <div className="p-4 rounded-xl bg-[#080E18] border border-slate-900 space-y-3">
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className="text-slate-400 uppercase tracking-widest">
            Processing Pipeline
          </span>
          <span className="text-[#00C9FF] font-bold">
            {isDone ? "SCAN COMPLETE" : `EVALUATING STAGE ${activeStep}/6`}
          </span>
        </div>
        
        {/* Glow progress bar */}
        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden relative">
          <div 
            className="h-full bg-gradient-to-r from-[#00C9FF] to-[#916BFF] transition-all duration-700 rounded-full shadow-[0_0_8px_rgba(0,201,255,0.4)]"
            style={{ width: `${(activeStep / 6) * 100}%` }}
          />
        </div>

        {/* Engine logger message */}
        <div className="text-[10px] font-mono bg-[#101A28]/80 px-2.5 py-2 rounded border border-slate-800 text-slate-300 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00C9FF] animate-ping" />
          <span className="text-slate-400">ENGINE LOGGER:</span>
          <span className="text-white font-medium">
            {activeStep === 0 && "Initializing Environmental Network Scan..."}
            {activeStep === 1 && "Evaluating citizen observation records and clustering..."}
            {activeStep === 2 && "Analyzing Gemini Multimodal classification vectors..."}
            {activeStep === 3 && "Querying NASA FIRMS active fire context..."}
            {activeStep === 4 && "Retrieving CPCB ground monitoring station telemetry..."}
            {activeStep === 5 && "Analyzing Google Weather atmospheric dispersion coefficients..."}
            {activeStep >= 6 && "Signal fusion complete. Supporting evidence convergence mapped."}
          </span>
        </div>
      </div>

      {/* Grid of clean evidence cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 5. CITIZEN CORRELATION CARD */}
        {activeStep >= 1 && (
          <div className="p-4 rounded-xl bg-[#162334]/50 border border-slate-800 space-y-3 animate-fade-in flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#00C9FF] font-mono text-xs font-bold uppercase tracking-wider">
                <Eye className="w-4 h-4" />
                <span>CITIZEN CORRELATION</span>
              </div>

               {reportCount > 1 || seededReportCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-white">
                    Nearby citizen observations correlated
                  </p>
                  <div className="text-[11px] font-mono text-slate-400 space-y-1">
                    {seededReportCount > 0 ? (
                      <div className="text-[10px] text-[#00C9FF]">
                        • {liveReportCount} live citizen observation{liveReportCount > 1 ? 's' : ''} + {seededReportCount} demo supporting observation{seededReportCount > 1 ? 's' : ''}
                      </div>
                    ) : (
                      <div>
                        • Correlated Observations: <span className="text-white font-bold">{liveReportCount} live reports</span>
                      </div>
                    )}
                    {hotspot?.fusion?.geospatialCorrelation !== undefined && (
                      <div>
                        • Geospatial Score: <span className="text-white font-bold">{hotspot.fusion.geospatialCorrelation.toFixed(2)}</span>
                      </div>
                    )}
                    {hotspot?.fusion?.temporalCorrelation !== undefined && (
                      <div>
                        • Temporal Score: <span className="text-white font-bold">{hotspot.fusion.temporalCorrelation.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No additional citizen observations correlated
                </p>
              )}
            </div>
          </div>
        )}

        {/* 6. AI EVIDENCE CARD */}
        {activeStep >= 2 && (
          <div className="p-4 rounded-xl bg-[#162334]/50 border border-slate-800 space-y-3 animate-fade-in flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#916BFF] font-mono text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>AI EVIDENCE</span>
              </div>

              {latestReport && (citizenCategory || aiDetectedCategory) ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                    <div>
                      <span className="block text-[9px] uppercase text-slate-500">CITIZEN CATEGORY</span>
                      <span className="text-white font-bold">{citizenCategory || "UNKNOWN"}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase text-slate-500">AI EVIDENCE CATEGORY</span>
                      <span className="text-white font-bold">{aiDetectedCategory || "UNKNOWN"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2">
                    <div>
                      <span className="text-[9px] text-slate-500 font-mono block uppercase">CATEGORY AGREEMENT</span>
                      <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                        categoryAgreement === "AGREES" 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : categoryAgreement === "CONFLICT"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {categoryAgreement || "INSUFFICIENT_EVIDENCE"}
                      </span>
                    </div>

                    {typeof aiConfidence === 'number' && (
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 font-mono block uppercase">GEMINI CONFIDENCE</span>
                        <span className="text-xs font-bold text-[#916BFF] font-mono">{Math.round(aiConfidence * 100)}%</span>
                      </div>
                    )}
                  </div>

                  {categoryAgreement === "CONFLICT" && categoryConflictReason && (
                    <div className="p-2 bg-rose-500/5 rounded border border-rose-500/10 text-[10px] text-rose-300 leading-relaxed font-mono">
                      {categoryConflictReason}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  AI evidence unavailable
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 7. ENVIRONMENTAL CONTEXT CARD */}
      {activeStep >= 3 && (
        <div className="p-5 rounded-xl bg-[#162334]/30 border border-slate-800 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Activity className="w-5 h-5 text-[#31D697]" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
              ENVIRONMENTAL CONTEXT
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* NASA FIRMS SECTION */}
            <div className="p-3 bg-[#101A28]/80 rounded-lg border border-slate-800 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    NASA FIRMS
                  </span>
                  {/* Badge representing missing evidence state */}
                  {(() => {
                    if (!tc) {
                      return <span className="text-[8px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">NOT QUERIED</span>;
                    }
                    if (!tc.available) {
                      return <span className="text-[8px] font-mono bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">UNAVAILABLE</span>;
                    }
                    if (tc.detectionFound) {
                      return <span className="text-[8px] font-mono bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded animate-pulse">DETECTION</span>;
                    }
                    return <span className="text-[8px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">NO DETECTION</span>;
                  })()}
                </div>

                {(() => {
                  if (!tc) {
                    return <p className="text-[11px] text-slate-400 font-mono italic">Not queried for this incident type</p>;
                  }
                  if (!tc.available) {
                    return <p className="text-[11px] text-red-400 font-mono italic">NASA FIRMS context unavailable</p>;
                  }
                  if (tc.detectionFound) {
                    return (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-rose-300 font-semibold">Thermal anomaly context detected</p>
                        <div className="text-[9px] font-mono text-slate-400 space-y-0.5">
                          {tc.nearestDetectionDistanceKm !== undefined && (
                            <div>• Distance: <span className="text-white font-medium">{tc.nearestDetectionDistanceKm.toFixed(1)} km</span></div>
                          )}
                          {(tc.acquisitionDate || tc.acquisitionTime) && (
                            <div>• Observation: <span className="text-white font-medium">{tc.acquisitionDate || ""} @ {tc.acquisitionTime || ""} UTC</span></div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1">
                      <p className="text-[11px] text-slate-300">No recent nearby thermal anomaly detected</p>
                      <p className="text-[9px] text-slate-500 leading-normal">
                        Satellite non-detection does not rule out a small or short-lived local incident.
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* GOVERNMENT AQ CONTEXT SECTION */}
            {activeStep >= 4 && (
              <div className="p-3 bg-[#101A28]/80 rounded-lg border border-slate-800 flex flex-col justify-between space-y-3 animate-fade-in">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      GOVERNMENT AQ
                    </span>
                    {gm && gm.available ? (
                      <span className="text-[8px] font-mono bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">AVAILABLE</span>
                    ) : (
                      <span className="text-[8px] font-mono bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">UNAVAILABLE</span>
                    )}
                  </div>

                  {gm && gm.available ? (
                    <div className="space-y-1.5 text-[10px] font-mono text-slate-400">
                      {gm.stationName && (
                        <div className="truncate"><span className="text-slate-500">STATION:</span> <span className="text-white font-bold">{gm.stationName}</span></div>
                      )}
                      {gm.pollutant && gm.currentValue !== undefined && (
                        <div><span className="text-slate-500">POLLUTANT:</span> <span className="text-white font-bold">{gm.currentValue} µg/m³ {gm.pollutant}</span></div>
                      )}
                      {gm.timestamp && (
                        <div className="text-[9px] text-slate-500">Recorded: {new Date(gm.timestamp).toLocaleTimeString()}</div>
                      )}

                      {gm.anomalyAvailable ? (
                        <div className="text-[9px] text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded inline-block mt-1">
                          AQ Anomaly: {gm.relativeAnomaly !== null && gm.relativeAnomaly !== undefined ? (gm.relativeAnomaly >= 0 ? "+" : "") + Math.round(gm.relativeAnomaly * 100) + "%" : "Detected"}
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-500 leading-normal italic mt-1">
                          Historical anomaly baseline not yet established
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-red-400 font-mono italic">Government AQ context unavailable</p>
                  )}
                </div>
              </div>
            )}

            {/* GOOGLE WEATHER SECTION */}
            {activeStep >= 5 && (
              <div className="p-3 bg-[#101A28]/80 rounded-lg border border-slate-800 flex flex-col justify-between space-y-3 animate-fade-in">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-blue-400" />
                      GOOGLE WEATHER
                    </span>
                    {wc && wc.available ? (
                      <span className="text-[8px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">AVAILABLE</span>
                    ) : (
                      <span className="text-[8px] font-mono bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">UNAVAILABLE</span>
                    )}
                  </div>

                  {wc && wc.available && weatherFields.length > 0 ? (
                    <div className="space-y-1 text-[9px] font-mono text-slate-400">
                      {weatherFields.map((field) => (
                        <div key={field.label} className="flex justify-between">
                          <span className="text-slate-500">{field.label.toUpperCase()}:</span>
                          <span className="text-white font-bold">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#A2B1C4] font-mono italic">Weather context unavailable</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. WHY THIS SIGNAL WAS PROMOTED */}
      {activeStep >= 6 && explanations.length > 0 && (
        <div className="p-4 rounded-xl bg-[#162334]/50 border border-slate-800 space-y-3 animate-fade-in">
          <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-2">
            WHY THIS SIGNAL WAS PROMOTED
          </div>
          <ul className="space-y-2">
            {explanations.map((exp, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-normal font-mono">
                <CheckCircle className="w-4 h-4 text-[#31D697] shrink-0 mt-0.5" />
                <span>{exp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 9. EVIDENCE CONVERGENCE SUMMARY */}
      {activeStep >= 6 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#162334] to-[#101A28] border border-slate-700 space-y-3 animate-fade-in">
          <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
            EVIDENCE CONVERGENCE
          </div>

          {score !== null && score >= 0.55 ? (
            <div className="p-3 rounded bg-[#00C9FF]/5 border border-[#00C9FF]/20 flex items-center gap-2.5 text-[#00C9FF]">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <div className="text-xs font-bold font-mono">
                Municipal verification recommended
              </div>
            </div>
          ) : (
            <div className="p-3 rounded bg-slate-900/60 border border-slate-800 flex items-center gap-2.5 text-slate-400">
              <HelpCircle className="w-5 h-5 shrink-0" />
              <div className="text-xs font-mono italic">
                Awaiting further sensory evidence
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
