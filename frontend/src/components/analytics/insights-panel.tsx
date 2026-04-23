"use client";

import { useCallback } from "react";
import useSWR from "swr";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
} from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { AnalyticsInsight } from "@/types/models";
import type { ApiResponse } from "@/types/api";

export function InsightsPanel() {
  const { data, isLoading, mutate } = useSWR<ApiResponse<AnalyticsInsight[]>>(
    "/analytics/insights",
    (url: string) => apiGet<ApiResponse<AnalyticsInsight[]>>(url),
    { revalidateOnFocus: false }
  );

  const insights = data?.data ?? [];

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">AI Insights</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
          />
          Refresh
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {/* Loading state */}
        {isLoading &&
          insights.length === 0 &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-gray-100 bg-gray-50/50 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-100" />
                  <div className="h-3 w-1/3 rounded bg-gray-100" />
                </div>
              </div>
            </div>
          ))}

        {/* Empty state */}
        {!isLoading && insights.length === 0 && (
          <div className="flex flex-col items-center py-8">
            <Sparkles className="h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              No insights available yet
            </p>
            <p className="text-xs text-gray-400">
              Insights will appear as more data is collected.
            </p>
          </div>
        )}

        {/* Insight items */}
        {insights.map((insight, index) => {
          const TrendIcon =
            insight.trend === "up"
              ? TrendingUp
              : insight.trend === "down"
              ? TrendingDown
              : Minus;

          const trendColor =
            insight.trend === "up"
              ? "text-green-600 bg-green-50"
              : insight.trend === "down"
              ? "text-red-600 bg-red-50"
              : "text-gray-500 bg-gray-100";

          return (
            <div
              key={index}
              className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 transition-colors hover:bg-gray-50"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                    trendColor
                  )}
                >
                  <TrendIcon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {insight.title}
                    </p>
                    {insight.changePercent !== undefined && (
                      <span
                        className={cn(
                          "flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                          insight.trend === "up"
                            ? "bg-green-50 text-green-700"
                            : insight.trend === "down"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {(insight.changePercent ?? 0) > 0 ? "+" : ""}
                        {(insight.changePercent ?? 0).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {insight.description}
                  </p>
                  <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {insight.metric}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
