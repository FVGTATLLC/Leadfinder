"use client";

import { useRouter } from "next/navigation";
import { Users, ListChecks, Calendar, Pause, Play, Archive } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { Campaign, CampaignType, TonePreset } from "@/types/models";

const campaignTypeVariants: Record<string, string> = {
  intro: "bg-blue-50 text-blue-700",
  follow_up: "bg-purple-50 text-purple-700",
  mice: "bg-emerald-50 text-emerald-700",
  corporate: "bg-indigo-50 text-indigo-700",
  custom: "bg-gray-100 text-gray-700",
};

const campaignStatusVariants: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-50 text-green-700",
  paused: "bg-yellow-50 text-yellow-700",
  completed: "bg-blue-50 text-blue-700",
  archived: "bg-amber-50 text-amber-700",
};

const toneLabels: Record<string, string> = {
  formal: "Formal",
  friendly: "Friendly",
  consultative: "Consultative",
  aggressive: "Aggressive",
};

const toneColors: Record<string, string> = {
  formal: "bg-slate-100 text-slate-600",
  friendly: "bg-amber-100 text-amber-600",
  consultative: "bg-primary-100 text-primary-600",
  aggressive: "bg-red-100 text-red-600",
};

interface CampaignCardProps {
  campaign: Campaign;
  onPause?: (campaign: Campaign) => void;
  onResume?: (campaign: Campaign) => void;
  onArchive?: (campaign: Campaign) => void;
}

export function CampaignCard({
  campaign,
  onPause,
  onResume,
  onArchive,
}: CampaignCardProps) {
  const router = useRouter();

  const progressPercent =
    campaign.stepCount > 0 && campaign.contactCount > 0
      ? Math.round(((campaign.contactCount * 0.5) / campaign.stepCount) * 100)
      : 0;

  return (
    <div
      onClick={() => router.push(`/dashboard/campaigns/${campaign.id}`)}
      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900 group-hover:text-primary-700">
            {campaign.name}
          </h3>
          {campaign.description && (
            <p className="mt-0.5 truncate text-sm text-gray-500">
              {campaign.description}
            </p>
          )}
        </div>
        {/* Quick actions */}
        <div className="ml-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {campaign.status === "active" && onPause && (
            <button
              onClick={() => onPause(campaign)}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-yellow-50 hover:text-yellow-600"
              title="Pause"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}
          {campaign.status === "paused" && onResume && (
            <button
              onClick={() => onResume(campaign)}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600"
              title="Resume"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          {campaign.status !== "archived" && onArchive && (
            <button
              onClick={() => onArchive(campaign)}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={campaign.campaignType} variantMap={campaignTypeVariants} />
        <StatusBadge status={campaign.status} variantMap={campaignStatusVariants} />
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", toneColors[campaign.tonePreset] ?? "bg-gray-100 text-gray-600")}>
          {toneLabels[campaign.tonePreset] ?? campaign.tonePreset}
        </span>
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-gray-400" />
          <span>{campaign.contactCount} contacts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5 text-gray-400" />
          <span>{campaign.stepCount} steps</span>
        </div>
      </div>

      {/* Strategy link */}
      {campaign.strategyName && (
        <div className="mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (campaign.strategyId) {
                router.push(`/dashboard/strategies/${campaign.strategyId}`);
              }
            }}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            Strategy: {campaign.strategyName}
          </button>
        </div>
      )}

      {/* Progress bar */}
      {campaign.stepCount > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full bg-primary-500 transition-all"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Calendar className="h-3 w-3" />
        <span>Created {formatDate(campaign.createdAt)}</span>
      </div>
    </div>
  );
}

export { campaignTypeVariants, campaignStatusVariants };
