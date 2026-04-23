import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const sizeDimensions = {
  sm: { width: 40, stroke: 3, fontSize: "text-[9px]" },
  md: { width: 56, stroke: 4, fontSize: "text-xs" },
  lg: { width: 80, stroke: 5, fontSize: "text-base" },
};

function getScoreColor(score: number): string {
  if (score > 0.7) return "text-green-500";
  if (score >= 0.4) return "text-yellow-500";
  return "text-red-500";
}

function getScoreStroke(score: number): string {
  if (score > 0.7) return "stroke-green-500";
  if (score >= 0.4) return "stroke-yellow-500";
  return "stroke-red-500";
}

export function ConfidenceIndicator({
  score,
  size = "md",
  label,
  className,
}: ConfidenceIndicatorProps) {
  const { width, stroke, fontSize } = sizeDimensions[size];
  const radius = (width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score !== null ? Math.round(score * 100) : 0;
  const offset = circumference - (pct / 100) * circumference;

  if (score === null) {
    return (
      <div className={cn("flex flex-col items-center", className)}>
        <div
          className="flex items-center justify-center rounded-full bg-gray-100"
          style={{ width, height: width }}
        >
          <span className={cn("font-medium text-gray-400", fontSize)}>
            &mdash;
          </span>
        </div>
        {label && (
          <span className="mt-1 text-[10px] text-gray-400">{label}</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width, height: width }}>
        <svg
          width={width}
          height={width}
          className="-rotate-90"
          viewBox={`0 0 ${width} ${width}`}
        >
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-gray-100"
          />
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn("transition-all duration-500", getScoreStroke(score))}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-semibold", fontSize, getScoreColor(score))}>
            {pct}%
          </span>
        </div>
      </div>
      {label && (
        <span className="mt-1 text-[10px] text-gray-500">{label}</span>
      )}
    </div>
  );
}
