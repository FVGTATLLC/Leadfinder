"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate, formatNumber } from "@/lib/utils";
import { apiGet } from "@/lib/api-client";
import type { Strategy } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
];

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-5 w-48 rounded bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-100" />
        </div>
        <div className="h-6 w-16 rounded-full bg-gray-200" />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="h-4 w-24 rounded bg-gray-100" />
        <div className="h-4 w-20 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function StrategiesPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set("status", statusFilter);

  const { data, isLoading } = useSWR<PaginatedResponse<Strategy>>(
    `/strategies?${queryParams.toString()}`,
    (url: string) => apiGet<PaginatedResponse<Strategy>>(url)
  );

  const strategies = data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ICP Strategies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Define your ideal customer profiles and discover matching companies.
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/strategies/new")}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Strategy
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {statusFilter && (
          <button
            onClick={() => setStatusFilter("")}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Strategy List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : strategies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <Target className="h-7 w-7 text-primary-600" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            No strategies yet
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-gray-500">
            Create your first ICP strategy to define target company profiles and
            let our AI discover matching companies.
          </p>
          <Button
            className="mt-6"
            onClick={() => router.push("/dashboard/strategies/new")}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create Strategy
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              onClick={() =>
                router.push(`/dashboard/strategies/${strategy.id}`)
              }
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-primary-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                  {strategy.name}
                </h3>
                <StatusBadge status={strategy.status} preset="strategy" />
              </div>
              {strategy.description && (
                <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">
                  {strategy.description}
                </p>
              )}
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  {formatNumber(strategy.companyCount)} companies
                </span>
                <span>{formatDate(strategy.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
