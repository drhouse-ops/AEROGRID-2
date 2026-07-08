import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { ForecastData } from "../types/api";

interface ForecastChartProps {
  forecast: ForecastData;
}

export default function ForecastChart({ forecast }: ForecastChartProps) {
  if (forecast?.available === false) {
    return (
      <div className="p-8 rounded-xl bg-[#101A28] border border-slate-800 text-center space-y-3">
        <p className="text-sm font-mono text-red-400 font-bold uppercase tracking-wider">
          FORECASTING NOT AVAILABLE IN LIVE PILOT MODE
        </p>
        <p className="text-xs text-slate-400 font-sans leading-normal">
          Operational forecasting models are undergoing pilot calibration.
        </p>
      </div>
    );
  }

  const data = forecast.points;

  // Custom Tooltip component for a high-tech style
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#162334] border border-slate-700 p-2 rounded shadow-xl font-mono text-xs">
          <p className="text-[#A2B1C4] mb-1">Time: {payload[0].payload.time}</p>
          <p className="text-[#00C9FF] font-bold">AQI Equivalent: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-mono text-[#A2B1C4] tracking-widest uppercase">24-Hour Prototype Forecast</h4>
          <p className="text-lg font-bold text-white mt-1">Air Quality Projection Index</p>
          <p className="text-[10px] italic text-red-400/80 font-mono mt-1">
            // DEMO-ONLY SYNTHETIC SCENARIO — NOT A FORECAST MODEL
          </p>
        </div>
        <div className="flex gap-4">
          <div className="px-3 py-2 bg-[#162334] rounded-lg border border-slate-800">
            <span className="text-[9px] font-mono text-[#A2B1C4] block uppercase">Spike Risk</span>
            <span className="text-sm font-bold font-mono text-[#FF5369]">{forecast.spikeRisk}%</span>
          </div>
          <div className="px-3 py-2 bg-[#162334] rounded-lg border border-slate-800">
            <span className="text-[9px] font-mono text-[#A2B1C4] block uppercase">Predicted Peak</span>
            <span className="text-sm font-bold font-mono text-[#FF8B1C]">{forecast.predictedSpikeTime} ({forecast.predictedSpikeValue})</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 10, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#162334" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#A2B1C4" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              dy={10}
            />
            <YAxis 
              stroke="#A2B1C4" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              domain={[50, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#162334', strokeWidth: 1 }} />
            <ReferenceLine 
              y={forecast.predictedSpikeValue} 
              stroke="#FF5369" 
              strokeDasharray="4 4" 
              label={{ 
                value: `PEAK ${forecast.predictedSpikeValue}`, 
                position: 'top', 
                fill: '#FF5369', 
                fontSize: 9, 
                fontWeight: 'bold', 
                fontFamily: 'monospace' 
              }} 
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#00C9FF"
              strokeWidth={3}
              dot={{ r: 4, stroke: '#080E18', strokeWidth: 2, fill: '#00C9FF' }}
              activeDot={{ r: 6, stroke: '#00C9FF', strokeWidth: 2, fill: '#080E18' }}
              style={{
                filter: "drop-shadow(0 0 6px rgba(0, 201, 255, 0.5))",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Forecast contributors */}
      <div className="pt-3 border-t border-slate-900">
        <h5 className="text-[10px] font-mono text-[#A2B1C4] tracking-wider uppercase mb-2">Contributors to Spike Risk</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {forecast.contributors.map((contrib, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-[#A2B1C4]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C9FF]" />
              <span>{contrib}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Limitations Disclosure */}
      <p className="text-[10px] text-slate-500 italic font-mono leading-relaxed mt-2 pt-2 border-t border-slate-900/40">
        ⚠️ Scientific limitation disclosure: This is a hackathon prototype forecasting layer. It is for demonstration purposes only and does not represent verified production-level meteorological or air quality accuracy.
      </p>
    </div>
  );
}
