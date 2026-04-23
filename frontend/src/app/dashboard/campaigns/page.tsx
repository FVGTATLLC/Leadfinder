"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { Plus, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/common/search-bar";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { apiGet, apiPatch } from "@/lib/api-client";
import type { Campaign } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "intro", label: "Intro" },
  { value: "follow_up", label: "Follow-up" },
  { value: "mice", label: "MICE" },
  { value: "corporate", label: "Corporate" },
  { value: "custom", label: "Custom" },
];

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
      <div className="h-5 w-2/3 rounded bg-gray-200" />
      <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
      <div className="mt-3 flex gap-2">
        <div className="h-5 w-16 rounded-full bg-gray-100" />
        <div className="h-5 w-14 rounded-full bg-gray-100" />
      </div>
      <div className="mt-4 flex gap-4">
        <div className="h-4 w-24 rounded bg-gray-100" />
        <div className="h-4 w-20 rounded bg-gray-100" />
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100" />
      <div className="mt-3 h-3 w-28 rounded bg-gray-100" />
    </div>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", "50");
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("campaign_type", typeFilter);
    return params.toString();
  }, [search, statusFilter, typeFilter]);

  const queryKey = `/campaigns?${buildQueryString()}`;

  const { data, isLoading } = useSWR<PaginatedResponse<Campaign>>(
    queryKey,
    (url: string) => apiGet<PaginatedResponse<Campaign>>(url)
  );

  const campaigns = data?.items ?? [];

  const handlePause = async (campaign: Campaign) => {
    try {
      await apiPatch(`/campaigns/${campaign.id}`, { status: "paused" });
      mutate(queryKey);
    } catch {
      // Silent
    }
  };

  const handleResume = async (campaign: Campaign) => {
    try {
      await apiPatch(`/campaigns/${campaign.id}`, { status: "active" });
      mutate(queryKey);
    } catch {
      // Silent
    }
  };

  const handleArchive = async (campaign: Campaign) => {
    try {
      await apiPatch(`/campaigns/${campaign.id}`, { status: "archived" });
      mutate(queryKey);
    } catch {
      // Silent
    }
  };

  const hasFilters = !!search || !!statusFilter || !!typeFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your outreach campaigns, track engagement, and optimize
            sequences.
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/campaigns/new")}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search campaigns..."
          value={search}
          onChange={setSearch}
          className="flex-1 sm:max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          {TYPE_OPTIONS.map((opt) => (
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
      {!isLoading && campaigns.length === 0 && !hasFilters && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Megaphone className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            No campaigns yet
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-gray-500">
            Create your first outreach campaign to start engaging with prospects.
          </p>
          <Button
            className="mt-5"
            onClick={() => router.push("/dashboard/campaigns/new")}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create Campaign
          </Button>
        </div>
      )}

      {/* No results with filters */}
      {!isLoading && campaigns.length === 0 && hasFilters && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
          <p className="text-sm text-gray-500">
            No campaigns match your filters.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setTypeFilter("");
            }}
            className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Campaign Grid */}
      {!isLoading && campaigns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onPause={handlePause}
              onResume={handleResume}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
