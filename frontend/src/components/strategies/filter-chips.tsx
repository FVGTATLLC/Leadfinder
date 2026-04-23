import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactNumber } from "@/lib/utils";
import type { StrategyFilters } from "@/types/models";

interface FilterChipsProps {
  filters: StrategyFilters;
  editable?: boolean;
  onRemove?: (
    category: keyof StrategyFilters,
    value?: string
  ) => void;
  className?: string;
}

interface ChipProps {
  label: string;
  color: string;
  onRemove?: () => void;
}

function Chip({ label, color, onRemove }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
        color
      )}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 transition-colors hover:bg-black/10"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export function FilterChips({
  filters,
  editable = false,
  onRemove,
  className,
}: FilterChipsProps) {
  const hasFilters =
    filters.industry.length > 0 ||
    (filters.city?.length ?? 0) > 0 ||
    filters.employeeMin !== null ||
    filters.employeeMax !== null ||
    filters.revenueMin !== null ||
    filters.revenueMax !== null ||
    filters.travelIntensity.length > 0 ||
    filters.customTags.length > 0;

  if (!hasFilters) {
    return (
      <p className="text-sm text-gray-400">No filters defined</p>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {filters.industry.map((item) => (
        <Chip
          key={`ind-${item}`}
          label={item}
          color="bg-blue-50 text-blue-700"
          onRemove={
            editable ? () => onRemove?.("industry", item) : undefined
          }
        />
      ))}

      {(filters.city ?? []).map((item) => (
        <Chip
          key={`city-${item}`}
          label={item}
          color="bg-green-50 text-green-700"
          onRemove={
            editable ? () => onRemove?.("city", item) : undefined
          }
        />
      ))}

      {(filters.employeeMin !== null || filters.employeeMax !== null) && (
        <Chip
          label={`Employees: ${
            filters.employeeMin !== null
              ? formatCompactNumber(filters.employeeMin)
              : "0"
          } - ${
            filters.employeeMax !== null
              ? formatCompactNumber(filters.employeeMax)
              : "Any"
          }`}
          color="bg-purple-50 text-purple-700"
          onRemove={
            editable ? () => onRemove?.("employeeMin") : undefined
          }
        />
      )}

      {(filters.revenueMin !== null || filters.revenueMax !== null) && (
        <Chip
          label={`Revenue: $${
            filters.revenueMin !== null
              ? formatCompactNumber(filters.revenueMin)
              : "0"
          } - $${
            filters.revenueMax !== null
              ? formatCompactNumber(filters.revenueMax)
              : "Any"
          }`}
          color="bg-orange-50 text-orange-700"
          onRemove={
            editable ? () => onRemove?.("revenueMin") : undefined
          }
        />
      )}

      {filters.travelIntensity.map((item) => (
        <Chip
          key={`ti-${item}`}
          label={`Travel: ${item.replace(/_/g, " ")}`}
          color="bg-red-50 text-red-700"
          onRemove={
            editable
              ? () => onRemove?.("travelIntensity", item)
              : undefined
          }
        />
      ))}

      {filters.customTags.map((item) => (
        <Chip
          key={`tag-${item}`}
          label={item}
          color="bg-gray-100 text-gray-700"
          onRemove={
            editable
              ? () => onRemove?.("customTags", item)
              : undefined
          }
        />
      ))}
    </div>
  );
}
