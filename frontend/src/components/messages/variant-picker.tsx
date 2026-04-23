"use client";

import { Plus } from "lucide-react";
import { cn, truncate } from "@/lib/utils";
import { ToneBadge } from "@/components/messages/tone-badge";
import type { MessageDraft } from "@/types/models";

interface VariantPickerProps {
  variants: MessageDraft[];
  selectedId: string;
  onSelect: (id: string) => void;
  onGenerateNew?: () => void;
}

export function VariantPicker({
  variants,
  selectedId,
  onSelect,
  onGenerateNew,
}: VariantPickerProps) {
  if (variants.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 py-8">
        <div className="text-center">
          <p className="text-sm text-gray-500">No variants available</p>
          {onGenerateNew && (
            <button
              onClick={onGenerateNew}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <Plus className="h-4 w-4" />
              Generate New Variant
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {variants.map((variant) => {
        const isSelected = variant.id === selectedId;
        return (
          <button
            key={variant.id}
            onClick={() => onSelect(variant.id)}
            className={cn(
              "flex min-w-[220px] max-w-[280px] flex-shrink-0 flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all hover:shadow-md",
              isSelected
                ? "border-primary-600 bg-primary-50/50 ring-2 ring-primary-600/20"
                : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              {variant.variantLabel ? (
                <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                  {variant.variantLabel}
                </span>
              ) : (
                <span className="text-xs text-gray-400">Default</span>
              )}
              <ToneBadge tone={variant.tone} />
            </div>
            <p className="text-sm font-medium text-gray-900">
              {truncate(variant.subject, 60)}
            </p>
            <p className="text-xs leading-relaxed text-gray-500">
              {truncate(variant.body, 100)}
            </p>
          </button>
        );
      })}

      {/* Generate new variant card */}
      {onGenerateNew && (
        <button
          onClick={onGenerateNew}
          className="flex min-w-[180px] flex-shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-4 text-gray-400 transition-all hover:border-primary-300 hover:bg-primary-50/30 hover:text-primary-600"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <Plus className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium">Generate New Variant</span>
        </button>
      )}
    </div>
  );
}
