import { cn } from "@/lib/utils";
import type { CampaignProgress } from "@/types/models";

interface CampaignProgressBarProps {
  progress: CampaignProgress;
  className?: string;
}

export function CampaignProgressBar({ progress, className }: CampaignProgressBarProps) {
  const { contactsPerStatus, totalContacts, overallProgressPercent } = progress;

  const segments = [
    {
      label: "Completed / Replied",
      count: contactsPerStatus.completed + contactsPerStatus.replied,
      color: "bg-green-500",
      textColor: "text-green-700",
    },
    {
      label: "Active",
      count: contactsPerStatus.active,
      color: "bg-blue-500",
      textColor: "text-blue-700",
    },
    {
      label: "Pending",
      count: progress.messagesPending,
      color: "bg-yellow-400",
      textColor: "text-yellow-700",
    },
    {
      label: "Bounced / Stopped",
      count: contactsPerStatus.bounced + contactsPerStatus.stopped,
      color: "bg-red-500",
      textColor: "text-red-700",
    },
  ];

  const total = totalContacts || 1;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Progress Bar */}
      <div className="relative">
        <div className="flex h-6 w-full overflow-hidden rounded-full bg-gray-100">
          {segments.map((segment) => {
            const pct = (segment.count / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={segment.label}
                className={cn("h-full transition-all duration-500", segment.color)}
                style={{ width: `${pct}%` }}
                title={`${segment.label}: ${segment.count}`}
              />
            );
          })}
        </div>
        {/* Percentage overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white drop-shadow-sm">
            {overallProgressPercent}%
          </span>
        </div>
      </div>

      {/* Labels */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-2.5 rounded-full", segment.color)} />
            <span className="text-xs text-gray-500">{segment.label}</span>
            <span className={cn("text-xs font-semibold", segment.textColor)}>
              {segment.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
