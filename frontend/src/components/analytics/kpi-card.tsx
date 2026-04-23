"use client";

import { type LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: string;
  change?: number;
  trend?: "up" | "down" | "flat";
  loading?: boolean;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  change,
  trend,
  loading = false,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="h-8 w-24 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded bg-gray-100" />
          </div>
          <div className="h-10 w-10 rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColorClass =
    trend === "up"
      ? "text-green-600 bg-green-50"
      : trend === "down"
      ? "text-red-600 bg-red-50"
      : "text-gray-500 bg-gray-50";

  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {typeof value === "number"
              ? new Intl.NumberFormat("en-US").format(value)
              : value}
          </p>
          {change !== undefined && trend && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
                  trendColorClass
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {change > 0 ? "+" : ""}
                {change.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
            color
          )}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}
