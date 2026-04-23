"use client";

import { useState } from "react";
import {
  X,
  Copy,
  RefreshCw,
  CheckCircle2,
  Lightbulb,
  Target,
  TrendingUp,
  Newspaper,
  List,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate, cn } from "@/lib/utils";
import type { ResearchBrief } from "@/types/models";

const briefTypeVariants: Record<string, string> = {
  company_summary: "bg-blue-50 text-blue-700",
  prospect_summary: "bg-purple-50 text-purple-700",
  talking_points: "bg-emerald-50 text-emerald-700",
  industry_brief: "bg-amber-50 text-amber-700",
};

interface ResearchDetailModalProps {
  brief: ResearchBrief | null;
  isOpen: boolean;
  onClose: () => void;
  onRegenerate?: (briefId: string) => void;
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-gray-500" />
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h3>
    </div>
  );
}

function BulletList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-700">
          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ResearchDetailModal({
  brief,
  isOpen,
  onClose,
  onRegenerate,
}: ResearchDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !brief) return null;

  const displayName = brief.companyName || brief.contactName || "Research Brief";

  const handleCopy = () => {
    const content = brief.content ?? {} as Record<string, unknown>;
    const text = [
      `Summary: ${content.summary ?? ""}`,
      "",
      "Key Facts:",
      ...(content.keyFacts ?? []).map((f: string) => `- ${f}`),
      "",
      "Talking Points:",
      ...(content.talkingPoints ?? []).map((t: string) => `- ${t}`),
      "",
      "Pain Points:",
      ...(content.painPoints ?? []).map((p: string) => `- ${p}`),
      "",
      "Opportunities:",
      ...(content.opportunities ?? []).map((o: string) => `- ${o}`),
      "",
      "Recent News:",
      ...(content.recentNews ?? []).map((n: string) => `- ${n}`),
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 mx-4 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-gray-900">
              {displayName}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge
                status={brief.briefType}
                variantMap={briefTypeVariants}
              />
              <span className="text-xs text-gray-500">
                Generated {formatDate(brief.createdAt)}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                {brief.llmModelUsed}
              </span>
            </div>
          </div>
          <div className="ml-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
            {onRegenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRegenerate(brief.id)}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Regenerate
              </Button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-140px)] overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Summary */}
            <div>
              <SectionHeader icon={FileText} title="Summary" />
              <p className="text-sm leading-relaxed text-gray-700">
                {brief.content?.summary || "No summary available."}
              </p>
            </div>

            {/* Key Facts */}
            {(brief.content?.keyFacts ?? []).length > 0 && (
              <div>
                <SectionHeader icon={List} title="Key Facts" />
                <BulletList
                  items={brief.content?.keyFacts ?? []}
                  emptyText="No key facts available."
                />
              </div>
            )}

            {/* Talking Points */}
            {(brief.content?.talkingPoints ?? []).length > 0 && (
              <div>
                <SectionHeader icon={Lightbulb} title="Talking Points" />
                <BulletList
                  items={brief.content?.talkingPoints ?? []}
                  emptyText="No talking points available."
                />
              </div>
            )}

            {/* Pain Points */}
            {(brief.content?.painPoints ?? []).length > 0 && (
              <div>
                <SectionHeader icon={Target} title="Pain Points" />
                <BulletList
                  items={brief.content?.painPoints ?? []}
                  emptyText="No pain points identified."
                />
              </div>
            )}

            {/* Opportunities */}
            {(brief.content?.opportunities ?? []).length > 0 && (
              <div>
                <SectionHeader icon={TrendingUp} title="Opportunities" />
                <BulletList
                  items={brief.content?.opportunities ?? []}
                  emptyText="No opportunities identified."
                />
              </div>
            )}

            {/* Recent News */}
            {(brief.content?.recentNews ?? []).length > 0 && (
              <div>
                <SectionHeader icon={Newspaper} title="Recent News" />
                <BulletList
                  items={brief.content?.recentNews ?? []}
                  emptyText="No recent news found."
                />
              </div>
            )}

            {/* Sources */}
            {(brief.sources ?? []).length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <SectionHeader icon={ExternalLink} title="Sources" />
                <ul className="space-y-1.5">
                  {(brief.sources ?? []).map((source, idx) => (
                    <li key={idx}>
                      {source.startsWith("http") ? (
                        <a
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 hover:underline"
                        >
                          {source}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm text-gray-600">{source}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
