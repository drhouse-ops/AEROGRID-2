import React from "react";
import { Hotspot } from "../types/api";
import { CheckCircle2, ShieldAlert, Sparkles, MapPin, Eye } from "lucide-react";

interface EvidenceTimelineProps {
  hotspot: Hotspot;
}

export default function EvidenceTimeline({ hotspot }: EvidenceTimelineProps) {
  const liveReport = hotspot.citizenReports.find(r => !r.isSeeded);
  const seededReport = hotspot.citizenReports.find(r => r.isSeeded);

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  const formatTime = (isoString?: string) => {
    if (!isoString) return "TIME UNAVAILABLE";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Conditionally include supporting observations in the timeline
  const otherLiveReports = hotspot.citizenReports.filter(r => !r.isSeeded && r.id !== liveReport?.id);
  const includeSupportingObs = (isDemoMode && !!seededReport) || otherLiveReports.length > 0;
  
  const supportingObsDescription = isDemoMode
    ? `Seeded Prototype Report located ~420m away was automatically correlated. Text: "${seededReport?.text}"`
    : `${otherLiveReports.length} additional live citizen report(s) correlated nearby.`;

  const analysisSource = liveReport?.analysis?.analysisSource;
  const isGemini = analysisSource === "GEMINI_MULTIMODAL";
  const geminiTitle = isGemini ? "Gemini Multimodal Evidence Analyzed" : "Fallback Evidence Analysis Applied";
  const geminiDesc = isGemini
    ? "Gemini processed the submitted citizen evidence."
    : "Deterministic fallback evidence analysis was applied.";
  const geminiCategory = isGemini ? "AI_MULTIMODAL_EVIDENCE" : "FALLBACK_EVIDENCE";

  const classification = hotspot?.fusion?.classification;

  const timelineItems = [
    ...(liveReport ? [
      {
        id: "live_obs",
        title: "Citizen Observation Received",
        time: formatTime(liveReport.timestamp),
        description: liveReport.text 
          ? `User reported: "${liveReport.text}" with localized photo.` 
          : (liveReport.imageUrl ? "Citizen image evidence submitted without text." : "Observation text unavailable"),
        icon: Eye,
        iconColor: "text-[#00C9FF] bg-[#00C9FF]/10 border-[#00C9FF]/30",
        category: "CITIZEN_OBSERVATION"
      }
    ] : []),
    ...(includeSupportingObs ? [
      {
        id: "seeded_obs",
        title: isDemoMode ? "Independent Supporting Observation Correlated" : "Correlated Citizen Observations",
        time: isDemoMode ? formatTime(seededReport?.timestamp) : "Correlated",
        description: supportingObsDescription,
        icon: MapPin,
        iconColor: "text-[#FF8B1C] bg-[#FF8B1C]/10 border-[#FF8B1C]/30",
        category: isDemoMode ? "PROTOTYPE_SUPPORTING" : "CITIZEN_SUPPORTING"
      }
    ] : []),
    {
      id: "ground_aq",
      title: "Ground AQ Context Evaluated",
      time: formatTime(hotspot.context.groundMonitoring.timestamp),
      description: hotspot.context.groundMonitoring.available
        ? `Retrieved data from ${hotspot.context.groundMonitoring.stationName}. PM2.5 at ${hotspot.context.groundMonitoring.currentValue} µg/m³ (${hotspot.context.groundMonitoring.relativeAnomaly !== null ? `+${Math.round(hotspot.context.groundMonitoring.relativeAnomaly * 100)}% relative anomaly` : 'baseline normal'}).`
        : "Ground monitoring context temporarily unavailable.",
      icon: CheckCircle2,
      iconColor: "text-[#31D697] bg-[#31D697]/10 border-[#31D697]/30",
      category: "GOVERNMENT_CONTEXT"
    },
    {
      id: "gemini_multimodal",
      title: geminiTitle,
      time: "Analysis Complete",
      description: geminiDesc,
      icon: Sparkles,
      iconColor: "text-[#916BFF] bg-[#916BFF]/10 border-[#916BFF]/30",
      category: geminiCategory
    },
    {
      id: "fusion_calc",
      title: "Heuristic Signal Fusion Evaluated",
      time: "Analysis Triggered",
      description: `Formula evaluation: H = 0.20C + 0.20V + 0.25S + 0.15G + 0.10T + 0.10M reached score ${hotspot.fusion.finalScore !== null && hotspot.fusion.finalScore !== undefined ? hotspot.fusion.finalScore.toFixed(2) : "AWAITING RESULT"} / 1.00.`,
      icon: Sparkles,
      iconColor: "text-[#916BFF] bg-[#916BFF]/15 border-[#916BFF]/40",
      category: "PROTOTYPE_FUSION"
    },
    ...(classification ? [
      {
        id: "hotspot_promoted",
        title: "Hyperlocal Hotspot Promoted",
        time: formatTime(hotspot.timestamp),
        description: `Promoted to ${classification}. Severity level set to ${hotspot.severity}.`,
        icon: ShieldAlert,
        iconColor: "text-[#FF5369] bg-[#FF5369]/10 border-[#FF5369]/30",
        category: "MUNICIPAL_PROMOTION"
      }
    ] : [])
  ];

  return (
    <div className="p-5 rounded-xl bg-[#101A28] border border-slate-800">
      <div className="mb-4">
        <h4 className="text-xs font-mono text-[#A2B1C4] tracking-widest uppercase">Evidence timeline</h4>
        <p className="text-lg font-bold text-white mt-1">Multi-source Signal Escalation</p>
      </div>

      <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-6">
        {timelineItems.map((item, idx) => {
          const IconComponent = item.icon;
          return (
            <div key={item.id} className="relative">
              {/* Node Bullet Circle */}
              <span className={`absolute -left-[35px] top-0.5 flex h-6.5 w-6.5 items-center justify-center rounded-full border text-xs ${item.iconColor}`}>
                <IconComponent className="h-3.5 w-3.5" />
              </span>

              <div className="space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h5 className="text-sm font-semibold text-white">{item.title}</h5>
                  <span className="text-[10px] font-mono text-[#A2B1C4]">{item.time}</span>
                </div>
                <p className="text-xs text-[#A2B1C4] leading-relaxed">{item.description}</p>
                
                {/* Category label */}
                <div className="pt-1">
                  <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-[#162334] text-[#A2B1C4] border border-slate-800">
                    {item.category}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
