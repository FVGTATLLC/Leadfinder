"use client";

import { useState } from "react";
import { Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiPost } from "@/lib/api-client";

interface BulkEnrichResult {
  enriched: number;
  failed: number;
  total: number;
}

interface BulkEnrichButtonProps {
  selectedContactIds: string[];
  onComplete: () => void;
}

export function BulkEnrichButton({
  selectedContactIds,
  onComplete,
}: BulkEnrichButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<BulkEnrichResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = selectedContactIds.length;

  const handleEnrich = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await apiPost<BulkEnrichResult>("/contacts/bulk-enrich", {
        contactIds: selectedContactIds,
      });
      setResult(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to enrich contacts"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setIsConfirmOpen(false);
    if (result) {
      onComplete();
      setResult(null);
    }
    setError(null);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsConfirmOpen(true)}
        disabled={count === 0}
      >
        <Sparkles className="mr-1 h-3.5 w-3.5" />
        Bulk Enrich ({count})
      </Button>

      <Modal
        isOpen={isConfirmOpen}
        onClose={handleClose}
        title={
          result
            ? "Enrichment Complete"
            : isProcessing
              ? "Enriching Contacts"
              : "Confirm Bulk Enrichment"
        }
        footer={
          result ? (
            <Button onClick={handleClose}>Done</Button>
          ) : isProcessing ? null : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleEnrich}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Enrich {count} Contact{count !== 1 ? "s" : ""}
              </Button>
            </>
          )
        }
      >
        {isProcessing && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
            <p className="mt-4 text-sm font-medium text-gray-700">
              Enriching {count} contact{count !== 1 ? "s" : ""}...
            </p>
            <p className="mt-1 text-xs text-gray-500">
              This may take a few moments.
            </p>
          </div>
        )}

        {!isProcessing && !result && !error && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              You are about to enrich{" "}
              <span className="font-semibold">{count}</span> contact
              {count !== 1 ? "s" : ""} using AI-powered data enrichment. This
              will attempt to find and verify contact information from available
              data sources.
            </p>
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Contacts that have already been enriched or verified will be
              skipped.
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-green-600" />
                <p className="mt-2 text-2xl font-bold text-green-700">
                  {result.enriched}
                </p>
                <p className="text-xs text-green-600">Enriched</p>
              </div>
              {result.failed > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                  <XCircle className="mx-auto h-6 w-6 text-red-600" />
                  <p className="mt-2 text-2xl font-bold text-red-700">
                    {result.failed}
                  </p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </Modal>
    </>
  );
}
