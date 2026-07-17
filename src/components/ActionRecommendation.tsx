import React from "react";
import { AlertTriangle, Clock, ShieldCheck, Flame, Droplet, Search, Eye } from "lucide-react";
import { Hotspot, DispatchStatus } from "../types/api";
import { isDemoMode } from "../services/api";

interface ActionRecommendationProps {
  hotspot: Hotspot;
  onDispatch: (teamName: string) => void;
  isDispatching: boolean;
}

export default function ActionRecommendation({ hotspot, onDispatch, isDispatching }: ActionRecommendationProps) {
  const dispatch = hotspot.dispatch;

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

  return (
    <div className="p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-5">
      <div className="flex items-start justify-between border-b border-slate-900 pb-4">
        <div>
          <h4 className="text-xs font-mono text-[#A2B1C4] tracking-widest uppercase">Response intelligence</h4>
          <p className="text-lg font-bold text-white mt-1">Recommended Municipal Action</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FF5369]/10 border border-[#FF5369]/20 text-[#FF5369] text-xs font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>WINDOW &lt;45 MIN</span>
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
              : dispatch?.status === "EN_ROUTE" 
                ? "bg-[#FF8B1C]/10 text-[#FF8B1C] border-[#FF8B1C]/30 animate-pulse" 
                : "bg-emerald-500/10 text-[#31D697] border-emerald-500/20"
          }`}>
            {!isDemoMode ? "NOT CONNECTED" : dispatch?.status === "EN_ROUTE" ? "EN ROUTE" : "UNIT AVAILABLE"}
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
        ) : dispatch?.status !== "EN_ROUTE" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-[#101A28] border border-slate-800 rounded-lg text-xs">
              <span className="text-[#A2B1C4]">Assigned Unit:</span>
              <span className="font-mono text-white font-semibold">Environmental Response Team 02</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#101A28] border border-slate-800 rounded-lg text-xs">
              <span className="text-[#A2B1C4]">Estimated Arrival Time (ETA):</span>
              <span className="font-mono text-[#00C9FF] font-semibold">18 MIN</span>
            </div>
            
            <button
              onClick={() => onDispatch("Environmental Response Team 02")}
              disabled={isDispatching}
              className="w-full py-3 px-4 bg-[#00C9FF] hover:bg-[#00b0df] disabled:bg-slate-800 text-[#080E18] font-bold text-xs font-mono tracking-widest rounded-lg transition-all duration-200 uppercase cursor-pointer"
            >
              {isDispatching ? "TRANSMITTING COMMAND..." : "DISPATCH RESPONSE TEAM"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-[#31D697]/5 border border-[#31D697]/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-[#31D697]">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-bold font-mono tracking-wider">TEAM DISPATCHED</span>
              </div>
              <p className="text-[11px] text-[#A2B1C4]">
                Environmental Response Team 02 has been simulated dispatched. Standard operational response logs have been initialized.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-[#101A28] border border-slate-800 rounded-lg">
                <span className="text-slate-500 block text-[9px] font-mono">STATUS</span>
                <span className="font-bold text-[#FF8B1C]">EN ROUTE</span>
              </div>
              <div className="p-2.5 bg-[#101A28] border border-slate-800 rounded-lg">
                <span className="text-slate-500 block text-[9px] font-mono">ETA</span>
                <span className="font-bold text-white font-mono">18 MIN</span>
              </div>
            </div>
          </div>
        )}

        {/* Dispatch Disclosure */}
        <p className="text-[9px] text-slate-500 font-mono italic leading-relaxed text-center">
          ⚠️ Dispatch simulation disclosure: This is a simulated prototype workflow. No actual Pune municipal teams or services are contacted.
        </p>
      </div>
    </div>
  );
}
