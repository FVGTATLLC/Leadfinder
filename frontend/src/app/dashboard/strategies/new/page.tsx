"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StrategyForm } from "@/components/strategies/strategy-form";
import { apiPost } from "@/lib/api-client";
import type { StrategyFilters } from "@/types/models";
import type { Strategy } from "@/types/models";
import type { ApiResponse } from "@/types/api";

export default function NewStrategyPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (
    data: { name: string; description: string; filters: StrategyFilters },
    activate: boolean
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiPost<ApiResponse<Strategy>>("/strategies", {
        name: data.name,
        description: data.description || null,
        filters: data.filters,
        status: activate ? "active" : "draft",
      });

      router.push(`/dashboard/strategies/${response.data.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create strategy"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Strategies
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Create New Strategy
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Define your ideal customer profile to target the right companies.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <StrategyForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
}
