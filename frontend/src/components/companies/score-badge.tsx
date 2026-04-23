import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "bg-green-50 text-green-700 ring-green-200";
  if (score >= 40) return "bg-yellow-50 text-yellow-700 ring-yellow-200";
  return "bg-red-50 text-red-700 ring-red-200";
}

const sizeClasses = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-base",
};

export function ScoreBadge({
  score,
  size = "md",
  className,
}: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-gray-100 font-medium text-gray-400 ring-1 ring-gray-200",
          sizeClasses[size],
          className
        )}
      >
        &mdash;
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold ring-1",
        getScoreColor(score),
        sizeClasses[size],
        className
      )}
    >
      {score}
    </span>
  );
}
