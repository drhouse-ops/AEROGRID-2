import React from "react";

interface ConfidenceGaugeProps {
  confidence: number; // 0.0 to 1.0
  title?: string;
  size?: number;
}

export default function ConfidenceGauge({ confidence, title = "CONFIDENCE", size = 120 }: ConfidenceGaugeProps) {
  const percentage = Math.round(confidence * 100);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (confidence * circumference);

  // Set color according to confidence level
  let strokeColor = "#00C9FF"; // Cyan
  let glowColor = "rgba(0, 201, 255, 0.4)";
  if (confidence > 0.85) {
    strokeColor = "#916BFF"; // AI Purple
    glowColor = "rgba(145, 107, 255, 0.4)";
  } else if (confidence < 0.50) {
    strokeColor = "#FF8B1C"; // Orange
    glowColor = "rgba(255, 139, 28, 0.4)";
  }

  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#162334]/40 border border-slate-800">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background track circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#101A28"
            strokeWidth={strokeWidth}
          />
          {/* Glowing active circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 4px ${glowColor})`,
              transition: "stroke-dashoffset 0.8s ease-in-out",
            }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono text-white" style={{ textShadow: `0 0 10px ${glowColor}` }}>
            {percentage}%
          </span>
          {title && <span className="text-[10px] font-mono tracking-widest text-[#A2B1C4] mt-0.5 uppercase">{title}</span>}
        </div>
      </div>
    </div>
  );
}
