"use client";

import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Sparkles,
  Loader2,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/common/status-badge";
import { FilterChips } from "@/components/strategies/filter-chips";
import { StrategyCompanyList } from "@/components/strategies/company-list";
import { StrategyForm } from "@/components/strategies/strategy-form";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import type { Strategy, Company, StrategyFilters } from "@/types/models";
import type { ApiResponse, PaginatedResponse } from "@/types/api";

export default function StrategyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const strategyId = params.id as string;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);

  const { data: strategyData, isLoading: strategyLoading } = useSWR<
    ApiResponse<Strategy>
  >(`/strategies/${strategyId}`, (url: string) =>
    apiGet<ApiResponse<Strategy>>(url)
  );

  const { data: companiesData, isLoading: companiesLoading } = useSWR<
    PaginatedResponse<Company>
  >(`/strategies/${strategyId}/companies`, (url: string) =>
    apiGet<PaginatedResponse<Company>>(url)
  );

  const strategy = strategyData?.data;
  const companies = companiesData?.items ?? [];

  const handleEdit = async (
    data: { name: string; description: string; filters: StrategyFilters },
    activate: boolean
  ) => {
    setEditLoading(true);
    setError(null);
    try {
      await apiPatch(`/strategies/${strategyId}`, {
        name: data.name,
        description: data.description || null,
        filters: data.filters,
        status: activate ? "active" : strategy?.status,
      });
      mutate(`/strategies/${strategyId}`);
      setIsEditOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update strategy"
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await apiDelete(`/strategies/${strategyId}`);
      router.push("/dashboard/strategies");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete strategy"
      );
      setDeleteLoading(false);
    }
  };

  const handleDiscover = async () => {
    if (!strategy) return;
    const searchTerms = strategy.filters.industry ?? [];
    const locations = strategy.filters.city ?? [];
    if (searchTerms.length === 0) {
      setError("Add at least one Search Term to the strategy before discovering.");
      return;
    }
    if (locations.length === 0) {
      setError("Add at least one Location to the strategy before discovering.");
      return;
    }
    setIsDiscovering(true);
    setError(null);
    try {
      const response = await apiPost<ApiResponse<{
        status: string;
        companiesFound: number;
        companiesAdded: number;
        error: string | null;
      }>>(`/strategies/${strategyId}/discover-maps`, {
        search_terms: searchTerms,
        location_query: locations.join(", "),
        max_per_search: strategy.filters.maxPerSearch ?? 50,
        skip_closed: true,
      });
      const result = response?.data;
      if (result?.status === "failed") {
        setError(result.error || "Discovery failed. Check Apify token is configured.");
      } else {
        mutate(`/strategies/${strategyId}/companies`);
        mutate(`/strategies/${strategyId}`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start discovery"
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleRemoveCompany = async (companyId: string) => {
    try {
      await apiDelete(`/strategies/${strategyId}/companies/${companyId}`);
      mutate(`/strategies/${strategyId}/companies`);
      mutate(`/strategies/${strategyId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove company"
      );
    }
  };

  if (strategyLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-gray-200" />
          <div className="h-8 w-72 rounded bg-gray-200" />
          <div className="h-4 w-48 rounded bg-gray-100" />
          <div className="mt-6 h-40 rounded-xl bg-gray-100" />
          <div className="h-64 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-lg font-semibold text-gray-900">
          Strategy not found
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          The strategy you are looking for does not exist or was deleted.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard/strategies")}
        >
          Back to Strategies
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/strategies")}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Strategies
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {strategy.name}
              </h1>
              <StatusBadge status={strategy.status} preset="strategy" />
            </div>
            {strategy.description && (
              <p className="mt-1 text-sm text-gray-500">
                {strategy.description}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Created {formatDate(strategy.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
            >
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActions(!showActions)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              {showActions && (
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      setShowActions(false);
                      setIsDeleteOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Strategy
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Target Filters
        </h2>
        <FilterChips filters={strategy.filters} />
      </div>

      {/* Discovery Section */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleDiscover}
          disabled={isDiscovering}
          variant={isDiscovering ? "outline" : "primary"}
        >
          {isDiscovering ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Discovering Companies...
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Discover Companies
            </>
          )}
        </Button>
        {isDiscovering && (
          <p className="text-sm text-gray-500">
            Scraping Google Maps for businesses matching your search terms
            and location. This usually takes 30 – 120 seconds.
          </p>
        )}
      </div>

      {/* Companies Section */}
      <StrategyCompanyList
        companies={companies}
        isLoading={companiesLoading}
        onRemove={handleRemoveCompany}
        onCompanyClick={(company) =>
          router.push(`/dashboard/companies/${company.id}`)
        }
      />

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Strategy"
        size="xl"
      >
        <StrategyForm
          initialData={{
            name: strategy.name,
            description: strategy.description ?? "",
            filters: strategy.filters,
          }}
          onSubmit={handleEdit}
          isLoading={editLoading}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Strategy"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={deleteLoading}
            >
              Delete Strategy
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete &ldquo;{strategy.name}&rdquo;? This
          action cannot be undone. Companies associated with this strategy will
          not be deleted.
        </p>
      </Modal>
    </div>
  );
}
