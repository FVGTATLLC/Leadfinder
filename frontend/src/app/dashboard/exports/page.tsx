"use client";

import { useState, useCallback, useEffect } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import {
  Download,
  Plus,
  X,
  RotateCcw,
  Trash2,
  FileDown,
  Loader2,
  FileText,
} from "lucide-react";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { ExportTypeSelector } from "@/components/exports/export-type-selector";
import { formatDate, formatNumber, cn } from "@/lib/utils";
import { ExportType } from "@/types/models";
import type { ExportJob } from "@/types/models";
import type { ApiResponse, PaginatedResponse } from "@/types/api";

const exportStatusVariants: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  processing: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
};

const exportTypeLabels: Record<string, string> = {
  companies: "Companies",
  contacts: "Contacts",
  activities: "Activities",
  crm_full: "Full CRM",
  campaign_report: "Campaign Report",
};

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "--";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default function ExportsPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ExportType | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch exports
  const { data, isLoading, mutate } = useSWR<PaginatedResponse<ExportJob>>(
    "/exports?page=1&per_page=50",
    (url: string) => apiGet<PaginatedResponse<ExportJob>>(url)
  );

  const exports = data?.items ?? [];

  // Check if we have pending/processing exports and auto-refresh
  const hasPendingExports = exports.some(
    (e) => e.status === "pending" || e.status === "processing"
  );

  useEffect(() => {
    if (!hasPendingExports) return;
    const interval = setInterval(() => {
      mutate();
    }, 10000);
    return () => clearInterval(interval);
  }, [hasPendingExports, mutate]);

  const handleCreateExport = async () => {
    if (!selectedType) return;
    setIsCreating(true);
    try {
      const body: Record<string, unknown> = {
        exportType: selectedType,
        format: "csv",
      };
      if (selectedType === ExportType.CAMPAIGN_REPORT && campaignId) {
        body.filters = { campaignId };
      }
      await apiPost("/exports", body);
      mutate();
      setShowModal(false);
      setSelectedType(null);
      setCampaignId("");
    } catch {
      // Error handled silently
    } finally {
      setIsCreating(false);
    }
  };

  const handleRetry = async (exportId: string) => {
    try {
      await apiPost(`/exports/${exportId}/retry`);
      mutate();
    } catch {
      // Silent
    }
  };

  const handleDelete = async (exportId: string) => {
    try {
      await apiDelete(`/exports/${exportId}`);
      mutate();
    } catch {
      // Silent
    }
  };

  const handleDownload = (exportJob: ExportJob) => {
    if (exportJob.fileUrl) {
      window.open(exportJob.fileUrl, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Exports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate and download data exports from your CRM.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Export
        </Button>
      </div>

      {/* Exports History */}
      {isLoading ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="animate-pulse p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-5 w-20 rounded bg-gray-200" />
                <div className="h-5 w-16 rounded bg-gray-100" />
                <div className="h-5 flex-1 rounded bg-gray-100" />
                <div className="h-5 w-12 rounded bg-gray-100" />
                <div className="h-5 w-24 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      ) : exports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <FileDown className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            No exports yet
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-gray-500">
            Generate your first data export to download companies, contacts, or
            campaign reports.
          </p>
          <Button className="mt-5" onClick={() => setShowModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Export
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    File Name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Records
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Size
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Completed
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {exports.map((exportJob) => (
                  <tr
                    key={exportJob.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {exportTypeLabels[exportJob.exportType] ??
                          exportJob.exportType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge
                          status={exportJob.status}
                          variantMap={exportStatusVariants}
                        />
                        {exportJob.status === "processing" && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">
                      {exportJob.fileName ?? (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">
                      {exportJob.recordCount !== null
                        ? formatNumber(exportJob.recordCount)
                        : "--"}
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">
                      {formatFileSize(exportJob.fileSize)}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {formatDate(exportJob.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {exportJob.completedAt
                        ? formatDate(exportJob.completedAt)
                        : "--"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {exportJob.status === "completed" &&
                          exportJob.fileUrl && (
                            <button
                              onClick={() => handleDownload(exportJob)}
                              className="rounded-md p-1.5 text-green-600 transition-colors hover:bg-green-50"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                        {exportJob.status === "failed" && (
                          <button
                            onClick={() => handleRetry(exportJob.id)}
                            className="rounded-md p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                            title="Retry"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(exportJob.id)}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Export Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  New Export
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Select what you want to export
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Export Type Selector */}
            <div className="mt-5">
              <ExportTypeSelector
                value={selectedType}
                onChange={setSelectedType}
              />
            </div>

            {/* Conditional: Campaign ID for Campaign Report */}
            {selectedType === ExportType.CAMPAIGN_REPORT && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  Campaign ID (optional)
                </label>
                <input
                  type="text"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  placeholder="Leave blank for all campaigns"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            )}

            {/* Format */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Format
              </label>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border-2 border-primary-500 bg-primary-50/50 px-4 py-2">
                  <FileText className="h-4 w-4 text-primary-600" />
                  <span className="text-sm font-medium text-primary-700">
                    CSV
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  More formats coming soon
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateExport}
                disabled={!selectedType || isCreating}
                isLoading={isCreating}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Generate Export
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
