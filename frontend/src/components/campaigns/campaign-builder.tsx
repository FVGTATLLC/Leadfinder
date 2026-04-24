"use client";

import { useState } from "react";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api-client";
import { ToneSelector } from "@/components/campaigns/tone-selector";
import { ContactSelector } from "@/components/campaigns/contact-selector";
import { CompanySelector } from "@/components/campaigns/company-selector";
import { StepEditor } from "@/components/campaigns/step-editor";
import type { Contact } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";
import { SequenceTimeline } from "@/components/campaigns/sequence-timeline";
import { cn } from "@/lib/utils";
import {
  CampaignType,
  TonePreset,
  StepType,
} from "@/types/models";
import type { SequenceStep } from "@/types/models";

interface CampaignBuilderProps {
  onComplete: (data: {
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
  }, activate: boolean) => void;
  strategies?: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

const WIZARD_STEPS = [
  { number: 1, label: "Basic Info" },
  { number: 2, label: "Select Contacts" },
  { number: 3, label: "Build Sequence" },
];

const campaignTypeOptions = [
  { value: CampaignType.INTRO, label: "Intro", description: "Initial outreach to new prospects", icon: "rocket" },
  { value: CampaignType.FOLLOW_UP, label: "Follow-up", description: "Follow up on previous conversations", icon: "refresh" },
  { value: CampaignType.MICE, label: "MICE", description: "Meetings, incentives, conferences & events", icon: "calendar" },
  { value: CampaignType.CORPORATE, label: "Corporate", description: "Corporate travel program outreach", icon: "building" },
  { value: CampaignType.CUSTOM, label: "Custom", description: "Custom campaign with flexible steps", icon: "settings" },
];

const campaignTypeColors: Record<string, string> = {
  intro: "border-blue-300 bg-blue-50",
  follow_up: "border-purple-300 bg-purple-50",
  mice: "border-emerald-300 bg-emerald-50",
  corporate: "border-indigo-300 bg-indigo-50",
  custom: "border-gray-300 bg-gray-50",
};

let tempStepId = 0;
function nextTempId() {
  return `temp-${++tempStepId}`;
}

export function CampaignBuilder({
  onComplete,
  strategies = [],
  isLoading = false,
}: CampaignBuilderProps) {
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Basic Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType | "">("");
  const [tonePreset, setTonePreset] = useState<TonePreset | "">("");
  const [strategyId, setStrategyId] = useState<string | null>(null);

  // Step 2: Targets (contacts AND/OR companies)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [targetTab, setTargetTab] = useState<"contacts" | "companies">("contacts");
  const [expandingCompanies, setExpandingCompanies] = useState(false);

  // Step 3: Sequence
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [showNewStepEditor, setShowNewStepEditor] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!name.trim()) newErrors.name = "Campaign name is required";
      if (!campaignType) newErrors.campaignType = "Select a campaign type";
      if (!tonePreset) newErrors.tonePreset = "Select a tone preset";
    }
    if (step === 2) {
      if (selectedContactIds.size === 0 && selectedCompanyIds.size === 0) {
        newErrors.contacts = "Select at least one contact or company";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, 3));
    }
  };

  const handlePrev = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  const handleAddStep = (afterStepNumber: number) => {
    const newStep: SequenceStep = {
      id: nextTempId(),
      campaignId: "",
      stepNumber: afterStepNumber + 1,
      delayDays: 1,
      stepType: StepType.EMAIL,
      subjectTemplate: "",
      bodyTemplate: "",
      isAiGenerated: false,
      createdAt: new Date().toISOString(),
    };

    const updated = sequenceSteps.map((s) =>
      s.stepNumber > afterStepNumber
        ? { ...s, stepNumber: s.stepNumber + 1 }
        : s
    );
    setSequenceSteps([...updated, newStep].sort((a, b) => a.stepNumber - b.stepNumber));
    setShowNewStepEditor(false);
  };

  const handleEditStep = (stepId: string, data: Partial<SequenceStep>) => {
    setSequenceSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...data } : s))
    );
  };

  const handleDeleteStep = (stepId: string) => {
    const removed = sequenceSteps.find((s) => s.id === stepId);
    if (!removed) return;
    const updated = sequenceSteps
      .filter((s) => s.id !== stepId)
      .map((s) =>
        s.stepNumber > removed.stepNumber
          ? { ...s, stepNumber: s.stepNumber - 1 }
          : s
      );
    setSequenceSteps(updated);
  };

  const handleReorder = (stepId: string, direction: "up" | "down") => {
    const idx = sequenceSteps.findIndex((s) => s.id === stepId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sequenceSteps.length) return;

    const updated = [...sequenceSteps];
    const tempNum = updated[idx].stepNumber;
    updated[idx] = { ...updated[idx], stepNumber: updated[swapIdx].stepNumber };
    updated[swapIdx] = { ...updated[swapIdx], stepNumber: tempNum };
    setSequenceSteps(updated.sort((a, b) => a.stepNumber - b.stepNumber));
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
      campaignId: "",
      stepNumber: sequenceSteps.length + 1,
      ...data,
      createdAt: new Date().toISOString(),
    };
    setSequenceSteps((prev) => [...prev, newStep]);
    setShowNewStepEditor(false);
  };

  const handleSubmit = async (activate: boolean) => {
    if (!validateStep(1) || !validateStep(2)) return;

    const finalIds = new Set(selectedContactIds);
    if (selectedCompanyIds.size > 0) {
      setExpandingCompanies(true);
      try {
        const results = await Promise.all(
          Array.from(selectedCompanyIds).map((cid) =>
            apiGet<PaginatedResponse<Contact>>(
              `/contacts?company_id=${cid}&per_page=200`
            ).catch(() => ({ items: [] as Contact[] }))
          )
        );
        results.forEach((r) => r.items.forEach((c) => finalIds.add(c.id)));
      } finally {
        setExpandingCompanies(false);
      }
    }

    if (finalIds.size === 0) {
      setErrors({
        contacts:
          "None of the selected companies have contacts yet. Add contacts or pick specific contacts.",
      });
      return;
    }

    onComplete(
      {
        name,
        description,
        campaignType: campaignType as CampaignType,
        tonePreset: tonePreset as TonePreset,
        strategyId,
        contactIds: Array.from(finalIds),
        steps: sequenceSteps.map((s) => ({
          delayDays: s.delayDays,
          stepType: s.stepType,
          subjectTemplate: s.subjectTemplate,
          bodyTemplate: s.bodyTemplate,
          isAiGenerated: s.isAiGenerated,
        })),
      },
      activate
    );
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center">
        {WIZARD_STEPS.map((step, idx) => (
          <div key={step.number} className="flex items-center">
            <button
              onClick={() => {
                if (step.number < currentStep) setCurrentStep(step.number);
              }}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                currentStep === step.number
                  ? "bg-primary-600 text-white shadow-md"
                  : step.number < currentStep
                    ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                    : "bg-gray-100 text-gray-500"
              )}
            >
              {step.number < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                  {step.number}
                </span>
              )}
              {step.label}
            </button>
            {idx < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 w-12",
                  step.number < currentStep ? "bg-primary-400" : "bg-gray-200"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {currentStep === 1 && (
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Campaign Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2026 MICE Outreach"
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the campaign goals..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          {/* Campaign Type */}
          <div>
            <label className="mb-3 block text-sm font-medium text-gray-700">
              Campaign Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {campaignTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCampaignType(opt.value)}
                  className={cn(
                    "flex flex-col items-center rounded-xl border-2 p-4 transition-all hover:shadow-md",
                    campaignType === opt.value
                      ? cn(campaignTypeColors[opt.value], "ring-2 ring-primary-500/30")
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <span className="text-sm font-semibold text-gray-900">
                    {opt.label}
                  </span>
                  <span className="mt-1 text-center text-[11px] text-gray-500">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
            {errors.campaignType && (
              <p className="mt-1 text-xs text-red-600">{errors.campaignType}</p>
            )}
          </div>

          {/* Tone */}
          <div>
            <label className="mb-3 block text-sm font-medium text-gray-700">
              Tone Preset <span className="text-red-500">*</span>
            </label>
            <ToneSelector
              value={tonePreset}
              onChange={setTonePreset}
            />
            {errors.tonePreset && (
              <p className="mt-1 text-xs text-red-600">{errors.tonePreset}</p>
            )}
          </div>

          {/* Strategy */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Link to Strategy (Optional)
            </label>
            <select
              value={strategyId ?? ""}
              onChange={(e) => setStrategyId(e.target.value || null)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">No strategy</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 2: Select Targets (Contacts and/or Companies) */}
      {currentStep === 2 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Select Targets
            </h2>
            <div className="text-sm text-gray-500">
              {selectedContactIds.size} contact{selectedContactIds.size !== 1 ? "s" : ""}
              {" + "}
              {selectedCompanyIds.size} compan{selectedCompanyIds.size !== 1 ? "ies" : "y"}
            </div>
          </div>

          <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setTargetTab("contacts")}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                targetTab === "contacts"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Contacts
            </button>
            <button
              type="button"
              onClick={() => setTargetTab("companies")}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                targetTab === "companies"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Companies
            </button>
          </div>

          {errors.contacts && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {errors.contacts}
            </div>
          )}

          {targetTab === "contacts" ? (
            <ContactSelector
              selectedIds={selectedContactIds}
              onChange={setSelectedContactIds}
              strategyId={strategyId}
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-500">
                Selecting a company will add all of its contacts to the campaign
                when you finish.
              </p>
              <CompanySelector
                selectedIds={selectedCompanyIds}
                onChange={setSelectedCompanyIds}
              />
            </>
          )}
        </div>
      )}

      {/* Step 3: Build Sequence */}
      {currentStep === 3 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Build Sequence
            </h2>
            <div className="flex items-center gap-2">
              {sequenceSteps.length === 0 && !showNewStepEditor && (
                <AISuggestSequenceButton
                  campaignType={campaignType}
                  tone={tonePreset}
                  onSequenceGenerated={(steps) => {
                    setSequenceSteps(steps.map((s: any, i: number) => ({
                      id: `ai-${i}`,
                      campaignId: "",
                      stepNumber: i + 1,
                      delayDays: s.delay_days ?? s.delayDays ?? (i === 0 ? 0 : 3),
                      stepType: (s.step_type ?? s.stepType ?? "email") as any,
                      subjectTemplate: s.subject ?? "",
                      bodyTemplate: s.body ?? "",
                      isAiGenerated: true,
                      createdAt: new Date().toISOString(),
                    })));
                  }}
                />
              )}
              {!showNewStepEditor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewStepEditor(true)}
                >
                  Add Step
                </Button>
              )}
            </div>
          </div>

          <SequenceTimeline
            steps={sequenceSteps}
            onEdit={handleEditStep}
            onDelete={handleDeleteStep}
            onAdd={handleAddStep}
            onReorder={handleReorder}
            editable
          />

          {showNewStepEditor && (
            <div className="mt-4 rounded-xl border border-primary-200 bg-primary-50/30 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                New Step
              </h3>
              <StepEditor
                campaignType={campaignType}
                tone={tonePreset}
                onSave={handleSaveNewStep}
                onCancel={() => setShowNewStepEditor(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 1}
        >
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {currentStep === 3 && (
            <>
              <Button
                variant="outline"
                onClick={() => handleSubmit(false)}
                isLoading={isLoading || expandingCompanies}
              >
                Save as Draft
              </Button>
              <Button
                onClick={() => handleSubmit(true)}
                isLoading={isLoading || expandingCompanies}
              >
                Create & Activate
              </Button>
            </>
          )}
          {currentStep < 3 && (
            <Button onClick={handleNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AISuggestSequenceButton({
  campaignType,
  tone,
  onSequenceGenerated,
}: {
  campaignType: string;
  tone: string;
  onSequenceGenerated: (steps: any[]) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    try {
      const result = await apiPost<any>("/campaigns/ai/suggest-sequence", {
        campaign_type: campaignType,
        tone: tone,
        num_steps: 4,
      });
      const data = result?.data || result;
      if (data.steps && data.steps.length > 0) {
        onSequenceGenerated(data.steps);
      }
    } catch (err) {
      console.error("AI sequence suggestion failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating sequence...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          AI Suggest Sequence
        </>
      )}
    </button>
  );
}
