"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn, formatNumber } from "@/lib/utils";
import { StatusBadge } from "@/components/common/status-badge";
import type { CampaignPerformanceData } from "@/types/models";

interface CampaignPerformanceChartProps {
  data: CampaignPerformanceData[];
}

type SortKey = "messagesSent" | "responseRate" | "contactsCount";
type TypeFilter = "" | "intro" | "follow_up" | "mice" | "corporate" | "custom";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "intro", label: "Intro" },
  { value: "follow_up", label: "Follow-up" },
  { value: "mice", label: "MICE" },
  { value: "corporate", label: "Corporate" },
  { value: "custom", label: "Custom" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "messagesSent", label: "Messages Sent" },
  { value: "responseRate", label: "Response Rate" },
  { value: "contactsCount", label: "Contacts" },
];

export function CampaignPerformanceChart({
  data,
}: CampaignPerformanceChartProps) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortKey>("messagesSent");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");

  const filtered = useMemo(() => {
    let result = [...data];
    if (typeFilter) {
      result = result.filter((d) => d.campaignType === typeFilter);
    }
    result.sort((a, b) => b[sortBy] - a[sortBy]);
    return result;
  }, [data, sortBy, typeFilter]);

  const maxMessages = Math.max(...filtered.map((d) => d.messagesSent), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Campaign Performance
          </h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Compare performance across campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-500">
            No campaigns match the selected filter.
          </div>
        )}
        {filtered.map((campaign) => {
          const barWidth = (campaign.messagesSent / maxMessages) * 100;
          return (
            <div
              key={campaign.campaignId}
              className="group cursor-pointer rounded-lg border border-gray-100 p-3 transition-all hover:border-gray-200 hover:bg-gray-50/50"
              onClick={() =>
                router.push(`/dashboard/campaigns/${campaign.campaignId}`)
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 group-hover:text-primary-700">
                    {campaign.campaignName}
                  </span>
                  <StatusBadge status={campaign.status} preset="campaign" />
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{formatNumber(campaign.contactsCount)} contacts</span>
                  <span>{formatNumber(campaign.messagesSent)} sent</span>
                  <span>{formatNumber(campaign.replies)} replies</span>
                </div>
              </div>

              {/* Bar */}
              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                  {/* Response rate overlay */}
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-xs font-semibold text-white drop-shadow-sm">
                      {formatNumber(campaign.messagesSent)} messages
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "min-w-[52px] rounded-full px-2.5 py-0.5 text-center text-xs font-bold",
                    campaign.responseRate >= 20
                      ? "bg-green-50 text-green-700"
                      : campaign.responseRate >= 10
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {(campaign.responseRate ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
