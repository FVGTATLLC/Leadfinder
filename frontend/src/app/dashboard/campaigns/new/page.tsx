"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { CampaignBuilder } from "@/components/campaigns/campaign-builder";
import { apiGet, apiPost } from "@/lib/api-client";
import type { Strategy, Campaign, CampaignType, TonePreset, StepType } from "@/types/models";
import type { ApiResponse, PaginatedResponse } from "@/types/api";

export default function NewCampaignPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: strategiesData } = useSWR<PaginatedResponse<Strategy>>(
    "/strategies?per_page=100&status=active",
    (url: string) => apiGet<PaginatedResponse<Strategy>>(url)
  );

  const strategies = (strategiesData?.items ?? []).map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const handleComplete = async (
    data: {
      name: string;
      description: string;
      campaignType: CampaignType;
      tonePreset: TonePreset;
      strategyId: string | null;
      contactIds: string[];
      steps: Array<{
        delayDays: number;
        stepType: StepType;
        subjectTemplate: string;
        bodyTemplate: string;
        isAiGenerated: boolean;
      }>;
    },
    activate: boolean
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiPost<ApiResponse<Campaign>>("/campaigns", {
        name: data.name,
        description: data.description || null,
        campaign_type: data.campaignType,
        tone_preset: data.tonePreset,
        strategy_id: data.strategyId,
        contact_ids: data.contactIds,
        steps: data.steps.map((s, idx) => ({
          step_number: idx + 1,
          delay_days: s.delayDays,
          step_type: s.stepType,
          subject_template: s.subjectTemplate,
          body_template: s.bodyTemplate,
          is_ai_generated: s.isAiGenerated,
        })),
        status: activate ? "active" : "draft",
      });

      router.push(`/dashboard/campaigns/${response.data.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create campaign"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Campaign</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up a new outreach campaign with contacts and sequences.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <CampaignBuilder
        onComplete={handleComplete}
        strategies={strategies}
        isLoading={isLoading}
      />
    </div>
  );
}
