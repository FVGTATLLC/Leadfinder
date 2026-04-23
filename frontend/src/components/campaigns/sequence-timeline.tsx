"use client";

import { useState } from "react";
import {
  Mail,
  Linkedin,
  ClipboardList,
  Clock,
  Pencil,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepEditor } from "@/components/campaigns/step-editor";
import { cn } from "@/lib/utils";
import { truncate } from "@/lib/utils";
import { StepType } from "@/types/models";
import type { SequenceStep } from "@/types/models";

const stepTypeIcons: Record<string, React.ElementType> = {
  email: Mail,
  linkedin_message: Linkedin,
  manual_task: ClipboardList,
};

const stepTypeColors: Record<string, string> = {
  email: "bg-blue-100 text-blue-600",
  linkedin_message: "bg-sky-100 text-sky-600",
  manual_task: "bg-amber-100 text-amber-600",
};

const stepTypeLabels: Record<string, string> = {
  email: "Email",
  linkedin_message: "LinkedIn Message",
  manual_task: "Manual Task",
};

interface SequenceTimelineProps {
  steps: SequenceStep[];
  onEdit?: (stepId: string, data: Partial<SequenceStep>) => void;
  onDelete?: (stepId: string) => void;
  onAdd?: (afterStepNumber: number) => void;
  onReorder?: (stepId: string, direction: "up" | "down") => void;
  editable?: boolean;
}

export function SequenceTimeline({
  steps,
  onEdit,
  onDelete,
  onAdd,
  onReorder,
  editable = false,
}: SequenceTimelineProps) {
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  const sortedSteps = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);

  return (
    <div className="relative">
      {/* Add step at beginning */}
      {editable && onAdd && (
        <div className="mb-4 flex justify-center">
          <button
            onClick={() => onAdd(0)}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600"
          >
            <Plus className="h-3 w-3" />
            Add First Step
          </button>
        </div>
      )}

      {sortedSteps.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
          <ClipboardList className="h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No steps in this sequence yet.</p>
          {editable && onAdd && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => onAdd(0)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Step
            </Button>
          )}
        </div>
      )}

      <div className="space-y-0">
        {sortedSteps.map((step, idx) => {
          const Icon = stepTypeIcons[step.stepType] ?? ClipboardList;
          const isEditing = editingStepId === step.id;

          return (
            <div key={step.id}>
              {/* Timeline connector */}
              <div className="relative flex gap-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
                      stepTypeColors[step.stepType] ?? "bg-gray-100 text-gray-600"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {idx < sortedSteps.length - 1 && (
                    <div className="h-full w-0.5 bg-gray-200" />
                  )}
                </div>

                {/* Step card */}
                <div className="mb-6 min-w-0 flex-1 pb-2">
                  {isEditing ? (
                    <div className="rounded-xl border border-primary-200 bg-white p-4 shadow-sm">
                      <StepEditor
                        step={step}
                        onSave={(data) => {
                          onEdit?.(step.id, data);
                          setEditingStepId(null);
                        }}
                        onCancel={() => setEditingStepId(null)}
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">
                              {step.stepNumber}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {stepTypeLabels[step.stepType] ?? step.stepType}
                            </span>
                            {step.isAiGenerated && (
                              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
                                AI
                              </span>
                            )}
                          </div>

                          {/* Delay indicator */}
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            <span>
                              {step.delayDays === 0
                                ? "Send immediately"
                                : `Wait ${step.delayDays} day${step.delayDays !== 1 ? "s" : ""}`}
                            </span>
                          </div>

                          {/* Subject */}
                          {step.subjectTemplate && (
                            <p className="mt-2 text-sm font-medium text-gray-700">
                              Subject: {truncate(step.subjectTemplate, 80)}
                            </p>
                          )}

                          {/* Body preview */}
                          {step.bodyTemplate && (
                            <p className="mt-1 text-xs text-gray-500">
                              {truncate(step.bodyTemplate, 150)}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        {editable && (
                          <div className="ml-3 flex items-center gap-1">
                            {onReorder && (
                              <>
                                <button
                                  onClick={() => onReorder(step.id, "up")}
                                  disabled={idx === 0}
                                  className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                                  title="Move up"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => onReorder(step.id, "down")}
                                  disabled={idx === sortedSteps.length - 1}
                                  className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                                  title="Move down"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setEditingStepId(step.id)}
                              className="rounded p-1 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {onDelete && (
                              <button
                                onClick={() => onDelete(step.id)}
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Add step between */}
                  {editable && onAdd && idx < sortedSteps.length - 1 && (
                    <div className="mt-2 flex justify-center">
                      <button
                        onClick={() => onAdd(step.stepNumber)}
                        className="flex items-center gap-1 rounded-full border border-dashed border-gray-200 px-2.5 py-1 text-[10px] font-medium text-gray-400 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        Add Step
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add step at end */}
      {editable && onAdd && sortedSteps.length > 0 && (
        <div className="mt-2 flex justify-center">
          <button
            onClick={() => onAdd(sortedSteps.length)}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600"
          >
            <Plus className="h-3 w-3" />
            Add Step
          </button>
        </div>
      )}
    </div>
  );
}
