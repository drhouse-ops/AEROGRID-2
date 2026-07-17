import React, { useEffect, useState } from "react";
import { AlertTriangle, Clock, ShieldCheck, Flame, Droplet, Search, Eye, CheckCircle2, XCircle, Radio } from "lucide-react";
import { Hotspot, DispatchStatus } from "../types/api";
import { isDemoMode } from "../services/api";

interface ActionRecommendationProps {
  hotspot: Hotspot;
  onDispatch: (teamName: string) => void;
  onAcknowledge: () => void;
  onResolve: () => void;
  onDismiss: (reason: string) => void;
  isDispatching: boolean;
}

const SLA_TARGET_MINUTES = 45;

export default function ActionRecommendation({
  hotspot,
  onDispatch,
  onAcknowledge,
  onResolve,
  onDismiss,
  isDispatching,
}: ActionRecommendationProps) {
  const dispatch = hotspot.dispatch;
  const [now, setNow] = useState(Date.now());
  const [dismissReason, setDismissReason] = useState("");

  // Tick every second so the SLA countdown stays live.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Render the appropriate icons/details for recommendations based on eventType
  const getRecommendations = () => {
    switch (hotspot.eventType) {
      case "OPEN_WASTE_BURNING":
        return [
          {
            title: "WASTE FIRE INSPECTION",
            description: "Inspect the probable event centroid near Shivajinagar Market for open burning of municipal trash/plastic.",
            icon: Flame,
            color: "text-[#FF5369] bg-[#FF5369]/10 border-[#FF5369]/20"
          },
          {
            title: "WATER MIST DEPLOYMENT",
            description: "Deploy tactical water mist cannons only if operationally available and appropriate to settle smoke particles.",
            icon: Droplet,
            color: "text-[#00C9FF] bg-[#00C9FF]/10 border-[#00C9FF]/20"
          },
          {
            title: "CONTINUOUS AQ MONITORING",
            description: "Track nearby ground AQ context at Shivajinagar CPCB Station to observe PM2.5 dispersion trends.",
            icon: Eye,
            color: "text-[#916BFF] bg-[#916BFF]/10 border-[#916BFF]/20"
          }
        ];
      case "CONSTRUCTION_DUST":
        return [
          {
            title: "CONSTRUCTION DUST INSPECTION",
            description: "Conduct on-site inspections of active construction sites within 300m centroid for particulate suppression controls.",
            icon: Search,
            color: "text-[#FF8B1C] bg-[#FF8B1C]/10 border-[#FF8B1C]/20"
          },
          {
            title: "WATER MIST DEPLOYMENT",
            description: "Authorize immediate dust suppression wetting over raw excavation surfaces.",
            icon: Droplet,
            color: "text-[#00C9FF] bg-[#00C9FF]/10 border-[#00C9FF]/20"
          }
        ];
      default:
        return [
          {
            title: "SITE INVESTIGATION",
            description: "Deploy mobile ground team to investigate the reported coordinates and report pollutant source details.",
            icon: Search,
            color: "text-[#00C9FF] bg-[#00C9FF]/10 border-[#00C9FF]/20"
          },
          {
            title: "CONTINUOUS AQ MONITORING",
            description: "Monitor real-time micro-sensor data and coordinate with regional municipal ward officers.",
            icon: Eye,
            color: "text-[#916BFF] bg-[#916BFF]/10 border-[#916BFF]/20"
          }
        ];
    }
  };

  const recommendations = getRecommendations();

  // ---- SLA timer logic ----
  const ackAt = dispatch?.acknowledgedAt ? new Date(dispatch.acknowledgedAt).getTime() : null;
  const resolvedAt = dispatch?.resolvedAt ? new Date(dispatch.resolvedAt).getTime() : null;
  const startRef = ackAt ?? (hotspot.timestamp ? new Date(hotspot.timestamp).getTime() : now);
  const endRef = resolvedAt ?? now;
  const elapsedMs = Math.max(0, endRef - startRef);
  const elapsedMin = elapsedMs / 60000;
  const remainingMs = Math.max(0, SLA_TARGET_MINUTES * 60000 - elapsedMs);
  const remainingMin = remainingMs / 60000;
  const slaBreached = !resolvedAt && remainingMs <= 0;
  const slaWithin = resolvedAt ? elapsedMs <= SLA_TARGET_MINUTES * 60000 : false;

  const fmt = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const status = dispatch?.status;

  return (
    <div className="p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-5">
      <div className="flex items-start justify-between border-b border-slate-900 pb-4">
        <div>
          <h4 className="text-xs font-mono text-[#A2B1C4] tracking-widest uppercase">Response intelligence</h4>
          <p className="text-lg font-bold text-white mt-1">Recommended Municipal Action</p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-xs ${
          slaBreached
            ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse"
            : slaWithin
            ? "bg-[#31D697]/10 text-[#31D697] border-[#31D697]/20"
            : "bg-[#FF8B1C]/10 text-[#FF8B1C] border-[#FF8B1C]/30"
        }`}>
          <Clock className="w-3.5 h-3.5" />
          <span>
            {resolvedAt ? `SLA ${slaWithin ? "MET" : "MISSED"} · ${fmt(elapsedMs)}` : `SLA ${fmt(remainingMs)} LEFT`}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {recommendations.map((rec, idx) => {
          const Icon = rec.icon;
          return (
            <div key={idx} className="flex gap-4 p-3 rounded-lg bg-[#162334]/60 border border-slate-800">
              <div className={`p-2 rounded-lg border h-fit ${rec.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-semibold text-white">{rec.title}</h5>
                <p className="text-xs text-[#A2B1C4] leading-relaxed">{rec.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* DISPATCH CONTROL PANEL */}
      <div className="p-4 rounded-xl bg-[#162334] border border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="text-xs font-mono text-[#A2B1C4] tracking-wider uppercase">
              {isDemoMode ? "Prototype Municipal Workflow" : "Municipal Workflow (Live)"}
            </h5>
            <p className="text-sm font-bold text-white mt-0.5">Environmental Dispatch Desk</p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
            !isDemoMode
              ? "bg-red-500/10 text-red-400 border-red-500/20"
              : status === "RESOLVED"
              ? "bg-[#31D697]/10 text-[#31D697] border-[#31D697]/20"
              : status === "EN_ROUTE" || status === "DISPATCHED"
              ? "bg-[#FF8B1C]/10 text-[#FF8B1C] border-[#FF8B1C]/30 animate-pulse"
              : status === "ACKNOWLEDGED"
              ? "bg-[#00C9FF]/10 text-[#00C9FF] border-[#00C9FF]/20"
              : "bg-emerald-500/10 text-[#31D697] border-emerald-500/20"
          }`}>
            {!isDemoMode ? "NOT CONNECTED" : status || "UNIT AVAILABLE"}
          </span>
        </div>

        {!isDemoMode ? (
          <div className="space-y-3 p-3 rounded-lg bg-red-500/5 border border-red-500/15">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-bold text-red-400 block font-mono">INTEGRATION STATUS</span>
                <p className="text-[11px] text-[#A2B1C4] leading-relaxed">
                  MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED. Live dispatch features are unavailable.
                </p>
              </div>
            </div>
            <button
              disabled={true}
              className="w-full py-3 px-4 bg-slate-800 text-slate-500 border border-slate-700/60 font-bold text-xs font-mono tracking-widest rounded-lg uppercase cursor-not-allowed"
            >
              MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED
            </button>
          </div>
        ) : status === "RESOLVED" ? (
          <div className="space-y-3">
            <div className="p-3 bg-[#31D697]/5 border border-[#31D697]/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-[#31D697]">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-xs font-bold font-mono tracking-wider">SIGNAL RESOLVED</span>
              </div>
              <p className="text-[11px] text-[#A2B1C4]">
                Field team closed this signal. Total response time: <span className="font-mono font-bold text-white">{fmt(elapsedMs)}</span> (target &lt; {SLA_TARGET_MINUTES} min).
              </p>
            </div>
            <button
              onClick={() => onDismiss("REOPENED_FOR_REVIEW")}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] font-mono tracking-widest rounded-lg uppercase transition-all cursor-pointer"
            >
              Reopen signal
            </button>
          </div>
        ) : status === "EN_ROUTE" || status === "DISPATCHED" ? (
          <div className="space-y-3">
            <div className="p-3 bg-[#31D697]/5 border border-[#31D697]/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-[#31D697]">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-bold font-mono tracking-wider">TEAM DISPATCHED</span>
              </div>
              <p className="text-[11px] text-[#A2B1C4]">
                {dispatch?.teamName || "Environmental Response Team 02"} is en route. ETA <span className="font-mono font-bold text-white">{dispatch?.etaMinutes ?? 18} MIN</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-[#101A28] border border-slate-800 rounded-lg">
                <span className="text-slate-500 block text-[9px] font-mono">STATUS</span>
                <span className="font-bold text-[#FF8B1C]">{status}</span>
              </div>
              <div className="p-2.5 bg-[#101A28] border border-slate-800 rounded-lg">
                <span className="text-slate-500 block text-[9px] font-mono">ELAPSED</span>
                <span className="font-bold text-white font-mono">{fmt(elapsedMs)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onResolve}
                disabled={isDispatching}
                className="flex-1 py-3 px-4 bg-[#31D697] hover:bg-[#2bc081] disabled:bg-slate-800 text-[#080E18] font-bold text-xs font-mono tracking-widest rounded-lg transition-all uppercase cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                MARK RESOLVED
              </button>
              <button
                onClick={() => onDismiss("FALSE_POSITIVE_FIELD_VERIFICATION")}
                disabled={isDispatching}
                className="px-3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] font-mono tracking-widest rounded-lg uppercase transition-all cursor-pointer flex items-center justify-center"
                title="Dismiss as false positive"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : status === "ACKNOWLEDGED" ? (
          <div className="space-y-3">
            <div className="p-3 bg-[#00C9FF]/5 border border-[#00C9FF]/20 rounded-lg space-y-1">
              <p className="text-[11px] text-[#A2B1C4]">
                Signal acknowledged by operator. Awaiting team dispatch. Elapsed: <span className="font-mono font-bold text-white">{fmt(elapsedMs)}</span>.
              </p>
            </div>
            <button
              onClick={() => onDispatch(dispatch?.teamName || "Environmental Response Team 02")}
              disabled={isDispatching}
              className="w-full py-3 px-4 bg-[#00C9FF] hover:bg-[#00b0df] disabled:bg-slate-800 text-[#080E18] font-bold text-xs font-mono tracking-widest rounded-lg transition-all uppercase cursor-pointer"
            >
              {isDispatching ? "TRANSMITTING COMMAND..." : "DISPATCH RESPONSE TEAM"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-[#101A28] border border-slate-800 rounded-lg text-xs">
              <span className="text-[#A2B1C4]">Assigned Unit:</span>
              <span className="font-mono text-white font-semibold">{dispatch?.teamName || "Environmental Response Team 02"}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#101A28] border border-slate-800 rounded-lg text-xs">
              <span className="text-[#A2B1C4]">SLA Target:</span>
              <span className="font-mono text-[#FF8B1C] font-semibold">&lt; {SLA_TARGET_MINUTES} MIN</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onAcknowledge}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] font-mono tracking-widest rounded-lg transition-all uppercase cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Radio className="w-4 h-4" />
                ACK
              </button>
              <button
                onClick={() => onDispatch(dispatch?.teamName || "Environmental Response Team 02")}
                disabled={isDispatching}
                className="py-3 px-4 bg-[#00C9FF] hover:bg-[#00b0df] disabled:bg-slate-800 text-[#080E18] font-bold text-xs font-mono tracking-widest rounded-lg transition-all uppercase cursor-pointer"
              >
                {isDispatching ? "TRANSMITTING..." : "DISPATCH"}
              </button>
            </div>
          </div>
        )}

        {/* Human-in-loop dismissal (demo) */}
        {isDemoMode && status !== "RESOLVED" && (
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Operator override (human-in-loop)</span>
            <div className="flex gap-2">
              <input
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Reason e.g. verified non-event"
                className="flex-1 bg-[#080E18] border border-slate-800 focus:border-[#FF5369] focus:ring-1 focus:ring-[#FF5369]/30 px-2.5 py-2 rounded text-[11px] text-white outline-none transition-all"
              />
              <button
                onClick={() => onDismiss(dismissReason || "MARKED_FALSE_POSITIVE_BY_OPERATOR")}
                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-[10px] font-mono tracking-widest rounded-lg uppercase transition-all cursor-pointer"
              >
                DISMISS
              </button>
            </div>
          </div>
        )}

        {/* Dispatch Disclosure */}
        <p className="text-[9px] text-slate-500 font-mono italic leading-relaxed text-center">
          ⚠️ Dispatch simulation disclosure: This is a simulated prototype workflow. No actual Pune municipal teams or services are contacted. SLA timer is for demonstration of response accountability.
        </p>
      </div>
    </div>
  );
}
