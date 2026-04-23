import { cn } from "@/lib/utils";

interface SkeletonLineProps {
  width?: string;
  height?: string;
  className?: string;
}

export function SkeletonLine({
  width = "100%",
  height = "16px",
  className,
}: SkeletonLineProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl border border-gray-200 bg-white p-6",
        className
      )}
      aria-hidden="true"
    >
      <div className="mb-4 h-5 w-1/3 rounded-md bg-gray-200" />
      <div className="space-y-3">
        <div className="h-4 w-full rounded-md bg-gray-200" />
        <div className="h-4 w-5/6 rounded-md bg-gray-200" />
        <div className="h-4 w-2/3 rounded-md bg-gray-200" />
      </div>
      <div className="mt-6 flex gap-3">
        <div className="h-9 w-24 rounded-lg bg-gray-200" />
        <div className="h-9 w-20 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  columns?: number;
  rows?: number;
  className?: string;
}

export function SkeletonTable({
  columns = 4,
  rows = 5,
  className,
}: SkeletonTableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-gray-200 bg-white",
        className
      )}
      aria-hidden="true"
    >
      <div className="border-b border-gray-200 bg-gray-50/80 px-4 py-3">
        <div className="flex gap-8">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-gray-200"
              style={{ width: `${60 + Math.random() * 40}px` }}
            />
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex items-center gap-8 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="h-4 animate-pulse rounded bg-gray-200"
                style={{
                  width: `${50 + Math.random() * 80}px`,
                  animationDelay: `${rowIdx * 100 + colIdx * 50}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  const widths = ["100%", "92%", "85%", "78%", "95%", "70%"];

  return (
    <div className={cn("space-y-2.5", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-md bg-gray-200"
          style={{
            width: widths[i % widths.length],
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}
