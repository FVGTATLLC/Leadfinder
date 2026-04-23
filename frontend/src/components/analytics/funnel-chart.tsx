"use client";

import { formatNumber } from "@/lib/utils";
import type { FunnelData } from "@/types/models";

interface FunnelChartProps {
  funnelData: FunnelData;
}

interface FunnelLevel {
  label: string;
  count: number;
  conversionRate?: number;
  color: string;
  textColor: string;
  bgLight: string;
}

export function FunnelChart({ funnelData }: FunnelChartProps) {
  const rates = (funnelData.conversionRates ?? {}) as Record<string, number>;

  const levels: FunnelLevel[] = [
    {
      label: "Strategies",
      count: funnelData.strategiesCount ?? 0,
      color: "bg-blue-500",
      textColor: "text-blue-700",
      bgLight: "bg-blue-50",
    },
    {
      label: "Companies",
      count: funnelData.companiesCount ?? 0,
      conversionRate: rates.strategiesToCompanies,
      color: "bg-indigo-500",
      textColor: "text-indigo-700",
      bgLight: "bg-indigo-50",
    },
    {
      label: "Contacts",
      count: funnelData.contactsCount ?? 0,
      conversionRate: rates.companiesToContacts,
      color: "bg-violet-500",
      textColor: "text-violet-700",
      bgLight: "bg-violet-50",
    },
    {
      label: "Enriched",
      count: funnelData.enrichedContacts ?? 0,
      conversionRate: rates.contactsToEnriched,
      color: "bg-purple-500",
      textColor: "text-purple-700",
      bgLight: "bg-purple-50",
    },
    {
      label: "Campaigns",
      count: funnelData.campaignsCount ?? 0,
      conversionRate: rates.enrichedToCampaigns,
      color: "bg-fuchsia-500",
      textColor: "text-fuchsia-700",
      bgLight: "bg-fuchsia-50",
    },
    {
      label: "Sent",
      count: funnelData.messagesSent ?? 0,
      conversionRate: rates.campaignsToMessages,
      color: "bg-emerald-500",
      textColor: "text-emerald-700",
      bgLight: "bg-emerald-50",
    },
    {
      label: "Replies",
      count: funnelData.repliesCount ?? 0,
      conversionRate: rates.messagesToReplies,
      color: "bg-green-500",
      textColor: "text-green-700",
      bgLight: "bg-green-50",
    },
  ];

  const maxCount = Math.max(...levels.map((l) => l.count), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Sales Funnel</h3>
      <p className="mt-1 text-sm text-gray-500">
        Conversion through the pipeline
      </p>

      <div className="mt-6 space-y-3">
        {levels.map((level, index) => {
          const widthPercent = Math.max(
            (level.count / maxCount) * 100,
            8
          );

          return (
            <div key={level.label}>
              {/* Conversion rate between levels */}
              {level.conversionRate !== undefined && index > 0 && (
                <div className="flex justify-center -mb-1 pb-1">
                  <span className="text-[10px] font-medium text-gray-400">
                    ↓ {(level.conversionRate ?? 0).toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Bar row */}
              <div className="flex items-center gap-3">
                {/* Label */}
                <div className="w-20 flex-shrink-0 text-right">
                  <span className={`text-xs font-semibold ${level.textColor}`}>
                    {level.label}
                  </span>
                </div>

                {/* Bar */}
                <div className="flex-1 h-9 rounded-lg bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full ${level.color} rounded-lg flex items-center justify-end pr-3 transition-all duration-500`}
                    style={{ width: `${widthPercent}%`, minWidth: "40px" }}
                  >
                    <span className="text-xs font-bold text-white drop-shadow-sm">
                      {formatNumber(level.count)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
