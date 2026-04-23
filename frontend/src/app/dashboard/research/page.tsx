"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Plus, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/common/search-bar";
import { ResearchBriefCard } from "@/components/research/research-brief-card";
import { ResearchDetailModal } from "@/components/research/research-detail-modal";
import { GenerateResearchModal } from "@/components/research/generate-research-modal";
import { apiGet, apiPost } from "@/lib/api-client";
import type { ResearchBrief } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";

const BRIEF_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "company_summary", label: "Company Summary" },
  { value: "prospect_summary", label: "Prospect Summary" },
  { value: "talking_points", label: "Talking Points" },
  { value: "industry_brief", label: "Industry Brief" },
];

const GENERATED_BY_OPTIONS = [
  { value: "", label: "All Sources" },
  { value: "agent", label: "AI Agent" },
  { value: "manual", label: "Manual" },
];

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
      <div className="h-5 w-2/3 rounded bg-gray-200" />
      <div className="mt-2 flex gap-2">
        <div className="h-5 w-20 rounded-full bg-gray-100" />
        <div className="h-5 w-14 rounded-full bg-gray-100" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-4/5 rounded bg-gray-100" />
        <div className="h-3 w-3/5 rounded bg-gray-100" />
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="h-2.5 w-3/4 rounded bg-gray-100" />
        <div className="h-2.5 w-2/3 rounded bg-gray-100" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="h-3 w-24 rounded bg-gray-100" />
        <div className="h-6 w-12 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const [search, setSearch] = useState("");
  const [briefType, setBriefType] = useState("");
  const [generatedBy, setGeneratedBy] = useState("");
  const [selectedBrief, setSelectedBrief] = useState<ResearchBrief | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", "50");
    if (search) params.set("search", search);
    if (briefType) params.set("brief_type", briefType);
    if (generatedBy) params.set("generated_by", generatedBy);
    return params.toString();
  }, [search, briefType, generatedBy]);

  const queryKey = `/research?${buildQueryString()}`;

  const { data, isLoading, mutate } = useSWR<PaginatedResponse<ResearchBrief>>(
    queryKey,
    (url: string) => apiGet<PaginatedResponse<ResearchBrief>>(url)
  );

  const briefs = data?.items ?? [];
  const hasFilters = !!search || !!briefType || !!generatedBy;

  const handleViewBrief = (brief: ResearchBrief) => {
    setSelectedBrief(brief);
    setIsModalOpen(true);
  };

  const handleRegenerate = async (briefId: string) => {
    try {
      await apiPost(`/research/${briefId}/regenerate`);
    } catch {
      // Silent
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Research Briefs</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-generated research briefs for companies and prospects.
          </p>
        </div>
        <Button onClick={() => setShowGenerateModal(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Generate New Research
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search by company or contact name..."
          value={search}
          onChange={setSearch}
          className="flex-1 sm:max-w-sm"
        />
        <select
          value={briefType}
          onChange={(e) => setBriefType(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          {BRIEF_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={generatedBy}
          onChange={(e) => setGeneratedBy(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          {GENERATED_BY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && briefs.length === 0 && !hasFilters && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <FileSearch className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            No research briefs yet
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-gray-500">
            Research briefs will appear here once generated by AI agents or
            created manually.
          </p>
          <Button className="mt-5" onClick={() => setShowGenerateModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Generate New Research
          </Button>
        </div>
      )}

      {/* No results with filters */}
      {!isLoading && briefs.length === 0 && hasFilters && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
          <p className="text-sm text-gray-500">
            No research briefs match your filters.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setBriefType("");
              setGeneratedBy("");
            }}
            className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Brief Grid */}
      {!isLoading && briefs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {briefs.map((brief) => (
            <ResearchBriefCard
              key={brief.id}
              brief={brief}
              onClick={() => handleViewBrief(brief)}
              onRegenerate={() => handleRegenerate(brief.id)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <ResearchDetailModal
        brief={selectedBrief}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBrief(null);
        }}
        onRegenerate={handleRegenerate}
      />

      {/* Generate Research Modal */}
      <GenerateResearchModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onSuccess={() => mutate()}
      />
    </div>
  );
}
