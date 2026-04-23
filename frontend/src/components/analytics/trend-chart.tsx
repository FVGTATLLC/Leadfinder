"use client";

import { useState, useMemo, useCallback } from "react";
import { cn, formatNumber } from "@/lib/utils";
import type { TrendData, TrendDataPoint } from "@/types/models";

interface TrendChartProps {
  data: TrendData;
  availableMetrics?: string[];
  onMetricChange?: (metric: string) => void;
  onPeriodChange?: (period: "daily" | "weekly" | "monthly") => void;
}

const PERIOD_OPTIONS: { value: "daily" | "weekly" | "monthly"; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const DEFAULT_METRICS = [
  "Messages Sent",
  "Replies",
  "Companies Added",
  "Contacts Added",
];

export function TrendChart({
  data,
  availableMetrics,
  onMetricChange,
  onPeriodChange,
}: TrendChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(data.period);
  const [selectedMetric, setSelectedMetric] = useState(data.metricName);

  const metrics = availableMetrics ?? DEFAULT_METRICS;

  const handlePeriodChange = (period: "daily" | "weekly" | "monthly") => {
    setSelectedPeriod(period);
    onPeriodChange?.(period);
  };

  const handleMetricChange = (metric: string) => {
    setSelectedMetric(metric);
    onMetricChange?.(metric);
  };

  const points = data.dataPoints;

  const { minVal, maxVal, polylinePoints, areaPoints, dotPositions } =
    useMemo(() => {
      if (points.length === 0) {
        return {
          minVal: 0,
          maxVal: 1,
          polylinePoints: "",
          areaPoints: "",
          dotPositions: [],
        };
      }

      const values = points.map((p) => p.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;
      const padding = range * 0.1;
      const effMin = min - padding;
      const effMax = max + padding;
      const effRange = effMax - effMin;

      const width = 600;
      const height = 200;
      const marginX = 0;

      const dots: { x: number; y: number; point: TrendDataPoint }[] = [];

      const lineCoords = points.map((p, i) => {
        const x =
          marginX +
          (points.length === 1
            ? width / 2
            : (i / (points.length - 1)) * (width - 2 * marginX));
        const y = height - ((p.value - effMin) / effRange) * height;
        dots.push({ x, y, point: p });
        return `${x},${y}`;
      });

      const polyline = lineCoords.join(" ");
      const firstX = dots[0]?.x ?? 0;
      const lastX = dots[dots.length - 1]?.x ?? width;
      const area = `${firstX},${height} ${polyline} ${lastX},${height}`;

      return {
        minVal: effMin,
        maxVal: effMax,
        polylinePoints: polyline,
        areaPoints: area,
        dotPositions: dots,
      };
    }, [points]);

  const formatDateLabel = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Trends</h3>
          <p className="mt-0.5 text-sm text-gray-500">{selectedMetric} over time</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedMetric}
            onChange={(e) => handleMetricChange(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {metrics.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-gray-300 bg-white">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handlePeriodChange(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg",
                  selectedPeriod === opt.value
                    ? "bg-primary-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative mt-5">
        {points.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-gray-500">
            No trend data available for this period.
          </div>
        ) : (
          <div className="relative">
            <svg
              viewBox="0 0 600 220"
              preserveAspectRatio="none"
              className="h-[240px] w-full"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <line
                  key={pct}
                  x1="0"
                  y1={200 - pct * 200}
                  x2="600"
                  y2={200 - pct * 200}
                  stroke="#f3f4f6"
                  strokeWidth="1"
                />
              ))}

              {/* Area fill */}
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon
                points={areaPoints}
                fill="url(#trendGrad)"
              />

              {/* Line */}
              <polyline
                points={polylinePoints}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points + hover targets */}
              {dotPositions.map((dot, i) => (
                <g key={i}>
                  {/* Invisible larger hit target */}
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r="12"
                    fill="transparent"
                    onMouseEnter={() => setHoveredPoint(i)}
                  />
                  {/* Visible dot */}
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r={hoveredPoint === i ? 5 : 3}
                    fill={hoveredPoint === i ? "#4f46e5" : "#6366f1"}
                    stroke="white"
                    strokeWidth="2"
                    className="transition-all duration-150"
                  />
                </g>
              ))}
            </svg>

            {/* X-axis labels */}
            <div className="mt-1 flex justify-between px-1 text-xs text-gray-400">
              {points.length > 0 && (
                <span>{formatDateLabel(points[0].date)}</span>
              )}
              {points.length > 2 && (
                <span>
                  {formatDateLabel(
                    points[Math.floor(points.length / 2)].date
                  )}
                </span>
              )}
              {points.length > 1 && (
                <span>
                  {formatDateLabel(points[points.length - 1].date)}
                </span>
              )}
            </div>

            {/* Tooltip */}
            {hoveredPoint !== null && dotPositions[hoveredPoint] && (
              <div
                className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
                style={{
                  left: `${(dotPositions[hoveredPoint].x / 600) * 100}%`,
                  top: `${(dotPositions[hoveredPoint].y / 220) * 100}%`,
                  transform: "translate(-50%, -120%)",
                }}
              >
                <p className="text-xs font-medium text-gray-900">
                  {formatNumber(dotPositions[hoveredPoint].point.value)}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDateLabel(dotPositions[hoveredPoint].point.date)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
