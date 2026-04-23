"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Users,
  Send,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { formatNumber, cn } from "@/lib/utils";
import type { CampaignProgress } from "@/types/models";
import type { ApiResponse } from "@/types/api";

interface CampaignStatsRowProps {
  campaignId: string;
}

type TrendDirection = "up" | "down" | "flat";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  valueColor?: string;
  trend: TrendDirection;
  isLoading?: boolean;
}

function StatCard({ icon: Icon, label, value, valueColor, trend, isLoading }: StatCardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-green-500"
      : trend === "down"
      ? "text-red-500"
      : "text-gray-400";

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse">
        <div className="h-5 w-5 rounded bg-gray-200" />
        <div className="h-7 w-16 rounded bg-gray-200" />
        <div className="h-3 w-20 rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <Icon className="h-5 w-5 text-gray-400" />
      <div className="flex items-center gap-1.5">
        <span className={cn("text-2xl font-bold text-gray-900", valueColor)}>
          {value}
        </span>
        <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />
      </div>
      <span className="text-xs font-medium text-gray-500">{label}</span>
    </div>
  );
}

export function CampaignStatsRow({ campaignId }: CampaignStatsRowProps) {
  const { data, isLoading } = useSWR<ApiResponse<CampaignProgress>>(
    `/campaigns/${campaignId}/progress`,
    (url: string) => apiGet<ApiResponse<CampaignProgress>>(url),
    { refreshInterval: 60000 }
  );

  const progress = data?.data;

  const totalContacts = progress?.totalContacts ?? 0;
  const messagesSent = progress?.messagesSent ?? 0;
  const repliesCount = progress?.repliesCount ?? 0;
  const responseRate =
    messagesSent > 0 ? Math.round((repliesCount / messagesSent) * 100) : 0;

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        icon={Users}
        label="Total Contacts"
        value={isLoading ? 0 : formatNumber(totalContacts)}
        trend="flat"
        isLoading={isLoading}
      />
      <StatCard
        icon={Send}
        label="Messages Sent"
        value={isLoading ? 0 : formatNumber(messagesSent)}
        valueColor="text-green-600"
        trend="up"
        isLoading={isLoading}
      />
      <StatCard
        icon={MessageCircle}
        label="Replies Received"
        value={isLoading ? 0 : formatNumber(repliesCount)}
        valueColor="text-purple-600"
        trend={repliesCount > 0 ? "up" : "flat"}
        isLoading={isLoading}
      />
      <StatCard
        icon={TrendingUp}
        label="Response Rate"
        value={isLoading ? "0%" : `${responseRate}%`}
        valueColor={responseRate > 10 ? "text-green-600" : "text-gray-900"}
        trend={responseRate > 0 ? "up" : "flat"}
        isLoading={isLoading}
      />
    </div>
  );
}
