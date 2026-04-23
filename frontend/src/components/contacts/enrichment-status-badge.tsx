import { Clock, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnrichmentStatus } from "@/types/models";

const statusConfig: Record<
  EnrichmentStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  [EnrichmentStatus.PENDING]: {
    label: "Pending",
    className: "bg-yellow-50 text-yellow-700 ring-yellow-200",
    icon: Clock,
  },
  [EnrichmentStatus.ENRICHED]: {
    label: "Enriched",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: CheckCircle2,
  },
  [EnrichmentStatus.FAILED]: {
    label: "Failed",
    className: "bg-red-50 text-red-700 ring-red-200",
    icon: XCircle,
  },
  [EnrichmentStatus.VERIFIED]: {
    label: "Verified",
    className: "bg-green-50 text-green-700 ring-green-200",
    icon: ShieldCheck,
  },
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-0.5 text-xs gap-1.5",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
};

interface EnrichmentStatusBadgeProps {
  status: EnrichmentStatus;
  size?: "sm" | "md";
  className?: string;
}

export function EnrichmentStatusBadge({
  status,
  size = "md",
  className,
}: EnrichmentStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig[EnrichmentStatus.PENDING];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium ring-1",
        config.className,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {config.label}
    </span>
  );
}
