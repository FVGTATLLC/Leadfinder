"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepEditor } from "@/components/campaigns/step-editor";
import { SequenceTimeline } from "@/components/campaigns/sequence-timeline";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { StepType } from "@/types/models";
import type { Campaign, SequenceStep } from "@/types/models";
import type { ApiResponse } from "@/types/api";

export default function SequenceEditorPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [localSteps, setLocalSteps] = useState<SequenceStep[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [showNewStepEditor, setShowNewStepEditor] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Fetch campaign
  const { data: campaignData, isLoading: campaignLoading } = useSWR<ApiResponse<Campaign>>(
    `/campaigns/${campaignId}`,
    (url: string) => apiGet<ApiResponse<Campaign>>(url)
  );
  const campaign = campaignData?.data;

  // Fetch steps
  const { data: stepsData, isLoading: stepsLoading } = useSWR<ApiResponse<SequenceStep[]>>(
    `/campaigns/${campaignId}/steps`,
    (url: string) => apiGet<ApiResponse<SequenceStep[]>>(url)
  );

  useEffect(() => {
    if (stepsData?.data) {
      setLocalSteps(stepsData.data);
    }
  }, [stepsData]);

  const isLoading = campaignLoading || stepsLoading;

  let tempCounter = 1000;
  const nextTempId = () => `new-${++tempCounter}`;

  const handleAddStep = (afterStepNumber: number) => {
    const newStep: SequenceStep = {
      id: nextTempId(),
      campaignId,
      stepNumber: afterStepNumber + 1,
      delayDays: 1,
      stepType: StepType.EMAIL,
      subjectTemplate: "",
      bodyTemplate: "",
      isAiGenerated: false,
      createdAt: new Date().toISOString(),
    };

    const updated = localSteps.map((s) =>
      s.stepNumber > afterStepNumber
        ? { ...s, stepNumber: s.stepNumber + 1 }
        : s
    );
    setLocalSteps([...updated, newStep].sort((a, b) => a.stepNumber - b.stepNumber));
    setIsDirty(true);
  };

  const handleEditStep = (stepId: string, data: Partial<SequenceStep>) => {
    setLocalSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...data } : s))
    );
    setIsDirty(true);
  };

  const handleDeleteStep = (stepId: string) => {
    const removed = localSteps.find((s) => s.id === stepId);
    if (!removed) return;
    const updated = localSteps
      .filter((s) => s.id !== stepId)
      .map((s) =>
        s.stepNumber > removed.stepNumber
          ? { ...s, stepNumber: s.stepNumber - 1 }
          : s
      );
    setLocalSteps(updated);
    setIsDirty(true);
  };

  const handleReorder = (stepId: string, direction: "up" | "down") => {
    const sorted = [...localSteps].sort((a, b) => a.stepNumber - b.stepNumber);
    const idx = sorted.findIndex((s) => s.id === stepId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const tempNum = sorted[idx].stepNumber;
    sorted[idx] = { ...sorted[idx], stepNumber: sorted[swapIdx].stepNumber };
    sorted[swapIdx] = { ...sorted[swapIdx], stepNumber: tempNum };
    setLocalSteps(sorted.sort((a, b) => a.stepNumber - b.stepNumber));
    setIsDirty(true);
  };

  const handleSaveNewStep = (data: {
    delayDays: number;
    stepType: StepType;
    subjectTemplate: string;
    bodyTemplate: string;
    isAiGenerated: boolean;
  }) => {
    const newStep: SequenceStep = {
      id: nextTempId(),
      campaignId,
      stepNumber: localSteps.length + 1,
      ...data,
      createdAt: new Date().toISOString(),
    };
    setLocalSteps((prev) => [...prev, newStep]);
    setShowNewStepEditor(false);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaveLoading(true);
    setError(null);
    try {
      await apiPost(`/campaigns/${campaignId}/steps/bulk`, {
        steps: localSteps.map((s, idx) => ({
          id: s.id.startsWith("new-") ? undefined : s.id,
          step_number: idx + 1,
          delay_days: s.delayDays,
          step_type: s.stepType,
          subject_template: s.subjectTemplate,
          body_template: s.bodyTemplate,
          is_ai_generated: s.isAiGenerated,
        })),
      });
      mutate(`/campaigns/${campaignId}/steps`);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sequence");
    } finally {
      setSaveLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-gray-200" />
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="h-96 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-lg font-semibold text-gray-900">Campaign not found</h2>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard/campaigns")}
        >
          Back to Campaigns
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push(`/dashboard/campaigns/${campaignId}`)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {campaign.name}
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Sequence Editor
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Edit the outreach sequence for {campaign.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? (
                <>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                  Exit Preview
                </>
              ) : (
                <>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Preview
                </>
              )}
            </Button>
            <Button
              onClick={handleSave}
              isLoading={saveLoading}
              disabled={!isDirty}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save Sequence
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isDirty && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          You have unsaved changes.
        </div>
      )}

      {/* Sequence Editor */}
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <SequenceTimeline
            steps={localSteps}
            onEdit={!previewMode ? handleEditStep : undefined}
            onDelete={!previewMode ? handleDeleteStep : undefined}
            onAdd={!previewMode ? handleAddStep : undefined}
            onReorder={!previewMode ? handleReorder : undefined}
            editable={!previewMode}
          />

          {/* New Step Editor */}
          {!previewMode && showNewStepEditor && (
            <div className="mt-6 rounded-xl border border-primary-200 bg-primary-50/30 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                New Step
              </h3>
              <StepEditor
                onSave={handleSaveNewStep}
                onCancel={() => setShowNewStepEditor(false)}
              />
            </div>
          )}

          {!previewMode && !showNewStepEditor && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowNewStepEditor(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add New Step
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
