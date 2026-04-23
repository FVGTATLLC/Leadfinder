import {
  Megaphone,
  Users,
  ListChecks,
  MessageSquare,
  Reply,
  Calendar,
  Shield,
} from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types/models";

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

interface CampaignStatusPanelProps {
  campaign: Campaign;
}

function StatItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1 rounded-lg bg-gray-50 p-3", className)}>
      <Icon className="h-4 w-4 text-gray-400" />
      <span className="text-lg font-bold text-gray-900">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </span>
    </div>
  );
}

export function CampaignStatusPanel({ campaign }: CampaignStatusPanelProps) {
  return (
    <div className="space-y-6">
      {/* Campaign Info */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Campaign Details
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Status</span>
            <StatusBadge status={campaign.status} variantMap={campaignStatusVariants} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Type</span>
            <StatusBadge status={campaign.campaignType} variantMap={campaignTypeVariants} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Tone</span>
            <span className="text-sm font-medium text-gray-700">
              {toneLabels[campaign.tonePreset] ?? campaign.tonePreset}
            </span>
          </div>
          {campaign.strategyName && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Strategy</span>
              <span className="text-sm font-medium text-primary-600">
                {campaign.strategyName}
              </span>
            </div>
          )}
          {campaign.startsAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Starts</span>
              <span className="text-sm text-gray-700">{formatDate(campaign.startsAt)}</span>
            </div>
          )}
          {campaign.endsAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Ends</span>
              <span className="text-sm text-gray-700">{formatDate(campaign.endsAt)}</span>
            </div>
          )}
          {campaign.approvedBy && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Approved</span>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-green-500" />
                <span className="text-sm text-gray-700">
                  {campaign.approvedAt ? formatDate(campaign.approvedAt) : "Yes"}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Created</span>
            <span className="text-sm text-gray-700">{formatDate(campaign.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Statistics
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatItem icon={Users} label="Contacts" value={campaign.contactCount} />
          <StatItem icon={ListChecks} label="Steps" value={campaign.stepCount} />
          <StatItem icon={MessageSquare} label="Sent" value={0} />
          <StatItem icon={Reply} label="Replies" value={0} />
        </div>
        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-center">
          <span className="text-xs font-medium text-gray-500">Response Rate</span>
          <p className="mt-0.5 text-2xl font-bold text-gray-900">0%</p>
        </div>
      </div>
    </div>
  );
}
