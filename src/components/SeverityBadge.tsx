import React from "react";
import { Severity } from "../types/api";

interface SeverityBadgeProps {
  severity: Severity | string;
}

export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  let bgColor = "bg-green-500/10 text-[#31D697] border-[#31D697]/30";
  let label = "Low";

  switch (severity) {
    case Severity.LOW:
      bgColor = "bg-green-500/10 text-[#31D697] border-[#31D697]/30";
      label = "LOW";
      break;
    case Severity.MODERATE:
      bgColor = "bg-amber-500/10 text-[#FF8B1C] border-[#FF8B1C]/30";
      label = "MODERATE";
      break;
    case Severity.HIGH:
      bgColor = "bg-red-500/10 text-[#FF5369] border-[#FF5369]/30";
      label = "HIGH";
      break;
    case Severity.CRITICAL:
      bgColor = "bg-red-600/20 text-[#FF5369] border-[#FF5369]/50 animate-pulse";
      label = "CRITICAL RISK";
      break;
    default:
      bgColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
      label = typeof severity === "string" ? severity : "UNKNOWN";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${bgColor}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {label}
    </span>
  );
}
