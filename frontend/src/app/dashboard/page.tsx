"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Target,
  Building2,
  Users,
  Send,
  Mail,
  TrendingUp,
  ArrowUpRight,
  Plus,
  Sparkles,
  RefreshCw,
  Globe,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiGet } from "@/lib/api-client";
import { formatNumber, formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/analytics/kpi-card";
import { FunnelChart } from "@/components/analytics/funnel-chart";
import { InsightsPanel } from "@/components/analytics/insights-panel";
import { StatusBadge } from "@/components/common/status-badge";
import type { DashboardKPIs, FunnelData, CampaignPerformanceData } from "@/types/models";
import type { ApiResponse } from "@/types/api";

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Fetch KPIs
  const {
    data: kpiData,
    isLoading: kpiLoading,
    mutate: kpiMutate,
  } = useSWR<ApiResponse<DashboardKPIs>>(
    "/analytics/dashboard",
    (url: string) => apiGet<ApiResponse<DashboardKPIs>>(url),
    { refreshInterval: AUTO_REFRESH_INTERVAL }
  );

  // Fetch Funnel
  const { data: funnelResponse, isLoading: funnelLoading } = useSWR<
    ApiResponse<FunnelData>
  >("/analytics/funnel", (url: string) => apiGet<ApiResponse<FunnelData>>(url), {
    refreshInterval: AUTO_REFRESH_INTERVAL,
  });

  // Fetch recent campaigns
  const { data: campaignsData, isLoading: campaignsLoading } = useSWR<
    ApiResponse<CampaignPerformanceData[]>
  >(
    "/analytics/campaigns/performance?limit=5",
    (url: string) =>
      apiGet<ApiResponse<CampaignPerformanceData[]>>(url),
    { refreshInterval: AUTO_REFRESH_INTERVAL }
  );

  const kpis = kpiData?.data;
  const funnel = funnelResponse?.data;
  const recentCampaigns = campaignsData?.data ?? [];

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{todayFormatted}</p>
        </div>
        <button
          onClick={() => kpiMutate()}
          className="flex items-center gap-1.5 self-start rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
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

      {/* Funnel + Recent Campaigns */}
      <div className="grid gap-6 lg:grid-cols-2">
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
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Funnel data will appear once you have strategies and campaigns.
            </p>
          </div>
        )}

        {/* Recent Campaigns */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Campaigns
            </h2>
            <button
              onClick={() => router.push("/dashboard/campaigns")}
              className="flex items-center gap-1 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
            >
              View all
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {campaignsLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3"
                >
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-gray-100" />
                </div>
              ))}

            {!campaignsLoading && recentCampaigns.length === 0 && (
              <div className="flex flex-col items-center py-8">
                <Send className="h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">
                  No campaigns yet
                </p>
              </div>
            )}

            {!campaignsLoading &&
              recentCampaigns.map((campaign) => (
                <div
                  key={campaign.campaignId}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3 transition-colors hover:bg-gray-50"
                  onClick={() =>
                    router.push(`/dashboard/campaigns/${campaign.campaignId}`)
                  }
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {campaign.campaignName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatNumber(campaign.messagesSent)} sent &middot;{" "}
                      {formatNumber(campaign.replies)} replies &middot;{" "}
                      {(campaign.responseRate ?? 0).toFixed(1)}% rate
                    </p>
                  </div>
                  <StatusBadge
                    status={campaign.status}
                    preset="campaign"
                  />
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <InsightsPanel />

      {/* Quick Actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="mt-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => router.push("/dashboard/strategies")}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <Plus className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">
                Create Strategy
              </p>
              <p className="text-xs text-gray-500">
                Define ICP targeting
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push("/dashboard/companies")}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
              <Building2 className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">
                Add Company
              </p>
              <p className="text-xs text-gray-500">
                Add to pipeline
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push("/dashboard/campaigns")}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-green-300 hover:bg-green-50/50 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-100">
              <Send className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">
                New Campaign
              </p>
              <p className="text-xs text-gray-500">
                Launch outreach
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
