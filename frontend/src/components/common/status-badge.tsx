import { cn } from "@/lib/utils";

const strategyStatusVariants: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-50 text-green-700",
  archived: "bg-amber-50 text-amber-700",
};

const campaignStatusVariants: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-50 text-green-700",
  paused: "bg-yellow-50 text-yellow-700",
  completed: "bg-blue-50 text-blue-700",
  archived: "bg-amber-50 text-amber-700",
};

const enrichmentStatusVariants: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  running: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
};

const presetVariants: Record<string, Record<string, string>> = {
  strategy: strategyStatusVariants,
  campaign: campaignStatusVariants,
  enrichment: enrichmentStatusVariants,
};

interface StatusBadgeProps {
  status: string;
  preset?: keyof typeof presetVariants;
  variantMap?: Record<string, string>;
  className?: string;
}

export function StatusBadge({
  status,
  preset,
  variantMap,
  className,
}: StatusBadgeProps) {
  const map = variantMap ?? (preset ? presetVariants[preset] : undefined);
  const colorClass = map?.[status] ?? "bg-gray-100 text-gray-700";

  const label = status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
}
