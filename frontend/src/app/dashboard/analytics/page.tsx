"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Target,
  Building2,
  Users,
  Send,
  Mail,
  TrendingUp,
  Download,
} from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/analytics/kpi-card";
import { FunnelChart } from "@/components/analytics/funnel-chart";
import { CampaignPerformanceChart } from "@/components/analytics/campaign-performance-chart";
import { RepPerformanceTable } from "@/components/analytics/rep-performance-table";
import { TrendChart } from "@/components/analytics/trend-chart";
import { InsightsPanel } from "@/components/analytics/insights-panel";
import type {
  DashboardKPIs,
  FunnelData,
  CampaignPerformanceData,
  RepPerformanceData,
  TrendData,
} from "@/types/models";
import type { ApiResponse } from "@/types/api";

type DateRange = "7d" | "30d" | "90d" | "custom";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export default function AnalyticsPage() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [trendMetric, setTrendMetric] = useState("Messages Sent");
  const [trendPeriod, setTrendPeriod] = useState<"daily" | "weekly" | "monthly">(
    "daily"
  );

  const rangeParam = `range=${dateRange}`;

  // KPIs
  const { data: kpiData, isLoading: kpiLoading } = useSWR<
    ApiResponse<DashboardKPIs>
  >(
    `/analytics/dashboard?${rangeParam}`,
    (url: string) => apiGet<ApiResponse<DashboardKPIs>>(url)
  );

  // Funnel
  const { data: funnelResponse, isLoading: funnelLoading } = useSWR<
    ApiResponse<FunnelData>
  >(
    `/analytics/funnel?${rangeParam}`,
    (url: string) => apiGet<ApiResponse<FunnelData>>(url)
  );

  // Campaign performance
  const { data: campPerfData, isLoading: campPerfLoading } = useSWR<
    ApiResponse<CampaignPerformanceData[]>
  >(
    `/analytics/campaigns/performance?${rangeParam}`,
    (url: string) =>
      apiGet<ApiResponse<CampaignPerformanceData[]>>(url)
  );

  // Rep performance
  const { data: repPerfData, isLoading: repPerfLoading } = useSWR<
    ApiResponse<RepPerformanceData[]>
  >(
    `/analytics/reps/performance?${rangeParam}`,
    (url: string) =>
      apiGet<ApiResponse<RepPerformanceData[]>>(url)
  );

  // Trends
  const trendMetricParam = encodeURIComponent(trendMetric);
  const { data: trendResponse, isLoading: trendLoading } = useSWR<
    ApiResponse<TrendData>
  >(
    `/analytics/trends?${rangeParam}&metric=${trendMetricParam}&period=${trendPeriod}`,
    (url: string) => apiGet<ApiResponse<TrendData>>(url)
  );

  const kpis = kpiData?.data;
  const funnel = funnelResponse?.data;
  const campPerf = campPerfData?.data ?? [];
  const repPerf = repPerfData?.data ?? [];
  const trendData = trendResponse?.data ?? {
    metricName: trendMetric,
    dataPoints: [],
    period: trendPeriod,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track performance and gain insights across your sales pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 bg-white">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-2 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  dateRange === opt.value
                    ? "bg-primary-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/exports")}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Strategies"
          value={kpis?.totalStrategies ?? 0}
          icon={Target}
          color="bg-blue-500"
          loading={kpiLoading}
        />
        <KpiCard
          title="Companies"
          value={kpis?.totalCompanies ?? 0}
          icon={Building2}
          color="bg-indigo-500"
          loading={kpiLoading}
        />
        <KpiCard
          title="Contacts"
          value={kpis?.totalContacts ?? 0}
          icon={Users}
          color="bg-violet-500"
          loading={kpiLoading}
        />
        <KpiCard
          title="Active Campaigns"
          value={kpis?.activeCampaigns ?? 0}
          icon={Send}
          color="bg-green-500"
          loading={kpiLoading}
        />
        <KpiCard
          title="Messages Sent"
          value={kpis?.messagesSent ?? 0}
          icon={Mail}
          color="bg-emerald-500"
          loading={kpiLoading}
        />
        <KpiCard
          title="Response Rate"
          value={
            kpis?.overallResponseRate !== undefined
              ? `${kpis.overallResponseRate.toFixed(1)}%`
              : "0%"
          }
          icon={TrendingUp}
          color="bg-orange-500"
          loading={kpiLoading}
        />
      </div>

      {/* Two-Column Layout */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-5">
          {/* Funnel */}
          {funnelLoading ? (
            <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="h-5 w-32 rounded bg-gray-200" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="mx-auto h-10 rounded bg-gray-100"
                    style={{ width: `${90 - i * 8}%` }}
                  />
                ))}
              </div>
            </div>
          ) : funnel ? (
            <FunnelChart funnelData={funnel} />
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-12 shadow-sm">
              <p className="text-sm text-gray-500">
                No funnel data available for this period.
              </p>
            </div>
          )}

          {/* Campaign Performance */}
          {campPerfLoading ? (
            <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="h-5 w-48 rounded bg-gray-200" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-gray-100" />
                ))}
              </div>
            </div>
          ) : (
            <CampaignPerformanceChart data={campPerf} />
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Rep Performance */}
          {repPerfLoading ? (
            <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="h-5 w-36 rounded bg-gray-200" />
              <div className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-gray-100" />
                ))}
              </div>
            </div>
          ) : (
            <RepPerformanceTable data={repPerf} />
          )}

          {/* Trend Chart */}
          {trendLoading ? (
            <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="h-5 w-24 rounded bg-gray-200" />
              <div className="mt-4 h-[240px] rounded bg-gray-100" />
            </div>
          ) : (
            <TrendChart
              data={trendData}
              onMetricChange={setTrendMetric}
              onPeriodChange={setTrendPeriod}
            />
          )}
        </div>
      </div>

      {/* AI Insights */}
      <InsightsPanel />
    </div>
  );
}
