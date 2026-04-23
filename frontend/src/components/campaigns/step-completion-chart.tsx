"use client";

import { cn } from "@/lib/utils";
import type { StepCompletion } from "@/types/models";

interface StepCompletionChartProps {
  stepsCompletion: StepCompletion[];
  className?: string;
}

export function StepCompletionChart({
  stepsCompletion,
  className,
}: StepCompletionChartProps) {
  if (!stepsCompletion || stepsCompletion.length === 0) {
    return (
      <div className={cn("rounded-xl border border-gray-200 bg-white p-6 shadow-sm", className)}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Step Completion
        </h3>
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-gray-400">No step data available yet.</p>
        </div>
      </div>
    );
  }

  // Find maximum total for scaling
  const maxTotal = Math.max(
    ...stepsCompletion.map((s) => s.sent + s.pending + (s.completed - s.sent)),
    1
  );

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-6 shadow-sm", className)}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Step-by-Step Completion
      </h3>

      <div className="space-y-3">
        {stepsCompletion.map((step) => {
          const total = step.sent + step.pending + Math.max(step.completed - step.sent, 0);
          const notYet = Math.max(total - step.sent - step.pending, 0);

          // Calculate widths as percentages of the total across all steps
          const sentPct = total > 0 ? (step.sent / maxTotal) * 100 : 0;
          const pendingPct = total > 0 ? (step.pending / maxTotal) * 100 : 0;
          const notYetPct = total > 0 ? (notYet / maxTotal) * 100 : 0;

          return (
            <div key={step.stepNumber} className="flex items-center gap-3">
              {/* Step label */}
              <div className="w-20 flex-shrink-0 text-right">
                <span className="text-xs font-medium text-gray-700">
                  Step {step.stepNumber}
                </span>
              </div>

              {/* Stacked bar */}
              <div className="flex flex-1 items-center gap-0">
                <div className="flex h-7 flex-1 overflow-hidden rounded-md bg-gray-50">
                  {/* Sent (green) */}
                  {sentPct > 0 && (
                    <div
                      className="flex h-full items-center justify-center bg-green-500 text-[10px] font-semibold text-white transition-all duration-500"
                      style={{ width: `${sentPct}%`, minWidth: sentPct > 0 ? "24px" : 0 }}
                      title={`Sent: ${step.sent}`}
                    >
                      {step.sent > 0 && step.sent}
                    </div>
                  )}
                  {/* Pending (yellow) */}
                  {pendingPct > 0 && (
                    <div
                      className="flex h-full items-center justify-center bg-yellow-400 text-[10px] font-semibold text-yellow-800 transition-all duration-500"
                      style={{ width: `${pendingPct}%`, minWidth: pendingPct > 0 ? "24px" : 0 }}
                      title={`Pending: ${step.pending}`}
                    >
                      {step.pending > 0 && step.pending}
                    </div>
                  )}
                  {/* Not yet (gray) */}
                  {notYetPct > 0 && (
                    <div
                      className="flex h-full items-center justify-center bg-gray-200 text-[10px] font-semibold text-gray-500 transition-all duration-500"
                      style={{ width: `${notYetPct}%`, minWidth: notYetPct > 0 ? "24px" : 0 }}
                      title={`Not yet: ${notYet}`}
                    >
                      {notYet > 0 && notYet}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-green-500" />
          <span className="text-xs text-gray-500">Sent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-yellow-400" />
          <span className="text-xs text-gray-500">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-gray-200" />
          <span className="text-xs text-gray-500">Not Yet</span>
        </div>
      </div>
    </div>
  );
}
