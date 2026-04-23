"use client";

import { Clock, RefreshCw, Eye, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate, cn } from "@/lib/utils";
import type { ResearchBrief } from "@/types/models";

const briefTypeVariants: Record<string, string> = {
  company_summary: "bg-blue-50 text-blue-700",
  prospect_summary: "bg-purple-50 text-purple-700",
  talking_points: "bg-emerald-50 text-emerald-700",
  industry_brief: "bg-amber-50 text-amber-700",
};

const generatedByVariants: Record<string, string> = {
  agent: "bg-violet-50 text-violet-700",
  manual: "bg-gray-100 text-gray-700",
};

interface ResearchBriefCardProps {
  brief: ResearchBrief;
  onClick?: () => void;
  onRegenerate?: () => void;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export function ResearchBriefCard({
  brief,
  onClick,
  onRegenerate,
}: ResearchBriefCardProps) {
  const expired = isExpired(brief.expiresAt);
  const displayName = brief.companyName || brief.contactName || "Unknown";

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md",
        expired ? "border-amber-200" : "border-gray-200 hover:border-gray-300"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900 group-hover:text-primary-700">
            {displayName}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge
              status={brief.briefType}
              variantMap={briefTypeVariants}
            />
            <StatusBadge
              status={brief.generatedBy.includes("agent") ? "agent" : "manual"}
              variantMap={generatedByVariants}
            />
            {expired && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                Stale
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <p className="mt-3 line-clamp-3 text-sm text-gray-600">
        {brief.content?.summary || "No summary available."}
      </p>

      {/* Key Facts */}
      {(brief.content?.keyFacts ?? []).length > 0 && (
        <ul className="mt-3 space-y-1">
          {(brief.content?.keyFacts ?? []).slice(0, 3).map((fact, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-gray-500">
              <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400" />
              <span className="line-clamp-1">{fact}</span>
            </li>
          ))}
          {(brief.content?.keyFacts ?? []).length > 3 && (
            <li className="text-xs font-medium text-primary-600">
              +{(brief.content?.keyFacts ?? []).length - 3} more facts
            </li>
          )}
        </ul>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          <span>{formatDate(brief.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="Regenerate"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClick}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
            title="View full brief"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
