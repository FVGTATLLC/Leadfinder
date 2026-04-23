"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterConfig {
  name: string;
  key: string;
  type: "select" | "multi-select" | "range";
  options?: { label: string; value: string }[];
  placeholder?: string;
}

interface FilterValues {
  [key: string]: string | string[] | { min: string; max: string };
}

interface FilterPanelProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onApply: () => void;
  onClear: () => void;
  className?: string;
}

export function FilterPanel({
  filters,
  values,
  onChange,
  onApply,
  onClear,
  className,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = Object.values(values).some((v) => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object" && v !== null) return v.min || v.max;
    return !!v;
  });

  const updateValue = (key: string, val: FilterValues[string]) => {
    onChange({ ...values, [key]: val });
  };

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs text-white">
              {Object.values(values).filter((v) => {
                if (Array.isArray(v)) return v.length > 0;
                if (typeof v === "object" && v !== null)
                  return v.min || v.max;
                return !!v;
              }).length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-gray-200 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filters.map((filter) => (
              <div key={filter.key}>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  {filter.name}
                </label>
                {filter.type === "select" && (
                  <select
                    value={(values[filter.key] as string) ?? ""}
                    onChange={(e) => updateValue(filter.key, e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="">{filter.placeholder ?? "All"}</option>
                    {filter.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
                {filter.type === "multi-select" && (
                  <div className="space-y-1.5">
                    {filter.options?.map((opt) => {
                      const selected =
                        ((values[filter.key] as string[]) ?? []).includes(
                          opt.value
                        );
                      return (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const current =
                                (values[filter.key] as string[]) ?? [];
                              updateValue(
                                filter.key,
                                selected
                                  ? current.filter((v) => v !== opt.value)
                                  : [...current, opt.value]
                              );
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                )}
                {filter.type === "range" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={
                        (
                          values[filter.key] as {
                            min: string;
                            max: string;
                          }
                        )?.min ?? ""
                      }
                      onChange={(e) =>
                        updateValue(filter.key, {
                          ...((values[filter.key] as {
                            min: string;
                            max: string;
                          }) ?? { min: "", max: "" }),
                          min: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="text-gray-400">&ndash;</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={
                        (
                          values[filter.key] as {
                            min: string;
                            max: string;
                          }
                        )?.max ?? ""
                      }
                      onChange={(e) =>
                        updateValue(filter.key, {
                          ...((values[filter.key] as {
                            min: string;
                            max: string;
                          }) ?? { min: "", max: "" }),
                          max: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="mr-1 h-3.5 w-3.5" />
              Clear Filters
            </Button>
            <Button size="sm" onClick={onApply}>
              Apply Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
