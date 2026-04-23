"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ToneBadge } from "@/components/messages/tone-badge";
import { TonePreset } from "@/types/models";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface RegenerateModalProps {
  messageId: string;
  currentTone: string;
  isOpen: boolean;
  onClose: () => void;
  onRegenerated: () => void;
}

const TONE_OPTIONS = [
  { value: TonePreset.FORMAL, label: "Formal" },
  { value: TonePreset.FRIENDLY, label: "Friendly" },
  { value: TonePreset.CONSULTATIVE, label: "Consultative" },
  { value: TonePreset.AGGRESSIVE, label: "Aggressive" },
];

interface GeneratedPreview {
  subject: string;
  body: string;
}

export function RegenerateModal({
  messageId,
  currentTone,
  isOpen,
  onClose,
  onRegenerated,
}: RegenerateModalProps) {
  const [toneOverride, setToneOverride] = useState(currentTone);
  const [variantLabel, setVariantLabel] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<GeneratedPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setPreview(null);
    try {
      const result = await apiPost<{ data: GeneratedPreview }>(
        `/messages/${messageId}/regenerate`,
        {
          tone: toneOverride,
          variantLabel: variantLabel || undefined,
          additionalContext: additionalContext || undefined,
        }
      );
      setPreview(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to regenerate message"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseThis = async () => {
    setIsSaving(true);
    try {
      await apiPost(`/messages/${messageId}/regenerate/confirm`);
      handleClose();
      onRegenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save message");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setToneOverride(currentTone);
    setVariantLabel("");
    setAdditionalContext("");
    setPreview(null);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Regenerate Message" size="lg">
      <div className="space-y-5">
        {/* Tone Selector */}
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-600">
            Tone Override
          </label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map((tone) => (
              <button
                key={tone.value}
                type="button"
                onClick={() => setToneOverride(tone.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all",
                  toneOverride === tone.value
                    ? "border-primary-600 bg-primary-50 text-primary-700 ring-2 ring-primary-600/20"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                )}
              >
                <ToneBadge tone={tone.value} />
                {toneOverride === tone.value && (
                  <Check className="h-3.5 w-3.5 text-primary-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Variant Label */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Variant Label (optional)
          </label>
          <input
            type="text"
            value={variantLabel}
            onChange={(e) => setVariantLabel(e.target.value)}
            placeholder="e.g., Version B, Short version..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {/* Additional Context */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Additional Instructions for AI
          </label>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Add specific instructions for the AI, e.g., 'Focus on MICE event capabilities' or 'Mention recent partnership with...'"
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-purple-200 bg-purple-50/50 py-10">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-purple-200 opacity-40" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <Sparkles className="h-6 w-6 animate-pulse text-purple-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-purple-700">
              AI is generating your message...
            </p>
            <p className="text-xs text-purple-500">
              This may take a few seconds
            </p>
          </div>
        )}

        {/* Preview */}
        {preview && !isGenerating && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">
              Generated Preview
            </h4>
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">
                  {preview.subject}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {preview.body}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={handleGenerate}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Try Again
              </Button>
              <Button onClick={handleUseThis} isLoading={isSaving}>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Use This
              </Button>
            </div>
          </div>
        )}

        {/* Generate Button (only if no preview yet) */}
        {!preview && !isGenerating && (
          <div className="flex items-center justify-end">
            <Button onClick={handleGenerate}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Regenerate
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
