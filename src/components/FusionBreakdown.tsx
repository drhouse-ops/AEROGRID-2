import React from "react";
import { Info, Check, Minus } from "lucide-react";
import { FusionEvaluation } from "../types/api";
import { FUSION_CONFIG } from "../config/fusionConfig";

interface FusionBreakdownProps {
  fusion: FusionEvaluation | null | undefined;
  className?: string;
}

interface Row {
  key: string;
  label: string;
  short: string;
  value: number | null;
  weight: number;
}

// Maps the fusion evaluation to a transparent, weighted breakdown table.
export default function FusionBreakdown({ fusion, className = "" }: FusionBreakdownProps) {
  if (!fusion) {
    return (
      <div className={`p-5 rounded-xl bg-[#101A28] border border-slate-800 ${className}`}>
        <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
          Signal Fusion Breakdown
        </div>
        <p className="text-xs text-slate-500 mt-3 italic">No fusion evaluation available yet.</p>
      </div>
    );
  }

  const w = FUSION_CONFIG.fusionWeights;
  const rows: Row[] = [
    { key: "C", label: "Citizen Report Correlation", short: "C", value: fusion.citizenReportCorrelation, weight: w.citizenReportCorrelation },
    { key: "V", label: "Visual Evidence Confidence", short: "V", value: fusion.visualEvidenceConfidence, weight: w.visualEvidenceConfidence },
    { key: "S", label: "Ground Monitoring Anomaly", short: "S", value: fusion.groundMonitoringAnomaly, weight: w.groundMonitoringAnomaly },
    { key: "G", label: "Geospatial Correlation", short: "G", value: fusion.geospatialCorrelation, weight: w.geospatialCorrelation },
    { key: "T", label: "Temporal Correlation", short: "T", value: fusion.temporalCorrelation, weight: w.temporalCorrelation },
    { key: "M", label: "Atmospheric Persistence", short: "M", value: fusion.atmosphericPersistence, weight: w.atmosphericPersistence },
  ];

  const active = rows.filter((r) => r.value !== null && r.value !== undefined);
  const inactive = rows.filter((r) => r.value === null || r.value === undefined);

  const colorFor = (v: number | null) => {
    if (v === null || v === undefined) return "text-slate-500";
    if (v >= 0.75) return "text-[#31D697]";
    if (v >= 0.5) return "text-[#FF8B1C]";
    if (v > 0) return "text-[#FFB020]";
    return "text-slate-500";
  };

  return (
    <div className={`p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-4 ${className}`}>
      <div className="flex items-start justify-between border-b border-slate-900 pb-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#00C9FF]" />
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#A2B1C4]">
            Why this is a signal
          </h4>
        </div>
        <span className="text-[10px] font-mono text-slate-500 bg-[#162334] px-2 py-0.5 rounded">
          Weighted Fusion · H = Σ wᵢ·xᵢ
        </span>
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const isActive = r.value !== null && r.value !== undefined;
          return (
            <div key={r.key} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-[#162334] border border-slate-800 flex items-center justify-center text-[11px] font-bold font-mono text-white shrink-0">
                {r.short}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[#A2B1C4] font-medium truncate">{r.label}</span>
                  <span className={`text-xs font-bold font-mono ${colorFor(r.value)}`}>
                    {isActive ? r.value!.toFixed(2) : "N/A"}
                  </span>
                </div>
                {/* contribution bar (value × weight, normalized to max possible) */}
                <div className="mt-1 h-1.5 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${isActive ? Math.max(2, r.value! * 100) : 0}%`,
                      background: isActive
                        ? "linear-gradient(90deg,#00C9FF,#916BFF)"
                        : "transparent",
                    }}
                  />
                </div>
              </div>
              <span className="text-[9px] font-mono text-slate-500 w-10 text-right shrink-0">
                w={r.weight}
              </span>
            </div>
          );
        })}
      </div>

      {/* Final score + classification */}
      <div className="pt-3 border-t border-slate-900 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Final Signal Strength</span>
          <span className="text-lg font-bold font-mono text-[#00C9FF]">{(fusion.finalScore * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Classification</span>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
            fusion.classification === "HIGH-CONFIDENCE SIGNAL"
              ? "bg-[#FF5369]/10 text-[#FF5369] border-[#FF5369]/30"
              : fusion.classification === "PROBABLE HOTSPOT"
              ? "bg-[#FF8B1C]/10 text-[#FF8B1C] border-[#FF8B1C]/30"
              : "bg-slate-800 text-slate-400 border-slate-700"
          }`}>
            {fusion.classification}
          </span>
        </div>
      </div>

      {/* Evidence availability disclosure */}
      <div className="pt-2 border-t border-slate-900 space-y-1.5">
        {active.length > 0 && (
          <div className="flex items-start gap-1.5 text-[10px] text-[#31D697] font-mono">
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Converged on {active.length} evidence dimension(s): {active.map((r) => r.short).join(", ")}</span>
          </div>
        )}
        {inactive.length > 0 && (
          <div className="flex items-start gap-1.5 text-[10px] text-slate-500 font-mono">
            <Minus className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Excluded (unavailable): {inactive.map((r) => r.short).join(", ")} — weights renormalized</span>
          </div>
        )}
      </div>
    </div>
  );
}
