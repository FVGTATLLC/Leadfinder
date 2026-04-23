"use client";

import { useState } from "react";
import { Sparkles, X, Save, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepType } from "@/types/models";
import type { SequenceStep } from "@/types/models";
import { apiPost } from "@/lib/api-client";

interface StepEditorProps {
  step?: Partial<SequenceStep>;
  campaignType?: string;
  tone?: string;
  contactContext?: {
    contactName?: string;
    jobTitle?: string;
    companyName?: string;
    industry?: string;
  };
  senderContext?: {
    senderName?: string;
    senderTitle?: string;
    senderPhone?: string;
  };
  onSave: (data: {
    delayDays: number;
    stepType: StepType;
    subjectTemplate: string;
    bodyTemplate: string;
    isAiGenerated: boolean;
  }) => void;
  onCancel: () => void;
}

const stepTypeOptions = [
  { value: StepType.EMAIL, label: "Email" },
  { value: StepType.LINKEDIN_MESSAGE, label: "LinkedIn Message" },
  { value: StepType.MANUAL_TASK, label: "Manual Task" },
];

export function StepEditor({ step, campaignType, tone, contactContext, senderContext, onSave, onCancel }: StepEditorProps) {
  const [delayDays, setDelayDays] = useState(step?.delayDays ?? 1);
  const [stepType, setStepType] = useState<StepType>(step?.stepType ?? StepType.EMAIL);
  const [subjectTemplate, setSubjectTemplate] = useState(step?.subjectTemplate ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(step?.bodyTemplate ?? "");
  const [isAiGenerated, setIsAiGenerated] = useState(step?.isAiGenerated ?? false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (delayDays < 0) newErrors.delayDays = "Delay must be 0 or more days";
    if (stepType === StepType.EMAIL && !subjectTemplate.trim()) {
      newErrors.subjectTemplate = "Subject is required for email steps";
    }
    if (!bodyTemplate.trim()) {
      newErrors.bodyTemplate = "Body template is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      delayDays,
      stepType,
      subjectTemplate,
      bodyTemplate,
      isAiGenerated,
    });
  };

  const handleAiGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await apiPost<any>("/campaigns/ai/generate-step", {
        campaign_type: campaignType || "intro",
        tone: tone || "formal",
        step_number: step?.stepNumber ?? 1,
        contact_name: contactContext?.contactName,
        job_title: contactContext?.jobTitle,
        company_name: contactContext?.companyName,
        industry: contactContext?.industry,
        sender_name: senderContext?.senderName,
        sender_title: senderContext?.senderTitle,
        sender_phone: senderContext?.senderPhone,
      });

      const data = result?.data || result;
      if (data.subject) setSubjectTemplate(data.subject);
      if (data.body) setBodyTemplate(data.body);
      setIsAiGenerated(true);
    } catch (err) {
      console.error("AI generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Delay & Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Delay (days)
          </label>
          <input
            type="number"
            min={0}
            value={delayDays}
            onChange={(e) => setDelayDays(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
          {errors.delayDays && (
            <p className="mt-1 text-xs text-red-600">{errors.delayDays}</p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Step Type
          </label>
          <select
            value={stepType}
            onChange={(e) => setStepType(e.target.value as StepType)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            {stepTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Subject (for email) */}
      {stepType === StepType.EMAIL && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Subject Template
          </label>
          <input
            type="text"
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
            placeholder="e.g., Quick question about {{company_name}}'s travel program"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
          {errors.subjectTemplate && (
            <p className="mt-1 text-xs text-red-600">{errors.subjectTemplate}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Use {"{{variable}}"} for dynamic content: {"{{first_name}}"}, {"{{company_name}}"}, {"{{job_title}}"}
          </p>
        </div>
      )}

      {/* Body */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          Body Template
        </label>
        <textarea
          value={bodyTemplate}
          onChange={(e) => setBodyTemplate(e.target.value)}
          placeholder="Write your message template here..."
          rows={8}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        {errors.bodyTemplate && (
          <p className="mt-1 text-xs text-red-600">{errors.bodyTemplate}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          Use {"{{variable}}"} syntax for personalization. Available: {"{{first_name}}"}, {"{{last_name}}"}, {"{{company_name}}"}, {"{{job_title}}"}, {"{{industry}}"}
        </p>
      </div>

      {/* AI Generate Button */}
      <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
        <button
          type="button"
          onClick={handleAiGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              Generate with AI
            </>
          )}
        </button>
        <span className="text-xs text-indigo-600">
          AI will write the subject and body based on campaign type and tone
        </span>
        {isAiGenerated && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            <Sparkles className="h-3 w-3" />
            AI Generated
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button type="submit" size="sm">
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Save Step
        </Button>
      </div>
    </form>
  );
}
