"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import {
  RefreshCw,
  StopCircle,
  MessageSquare,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/common/status-badge";
import { apiGet, apiPost } from "@/lib/api-client";
import { formatDate, getInitials, cn } from "@/lib/utils";
import type { CampaignContact, CampaignProgress } from "@/types/models";
import type { ApiResponse, PaginatedResponse } from "@/types/api";

const contactStatusVariants: Record<string, string> = {
  active: "bg-blue-50 text-blue-700",
  replied: "bg-green-50 text-green-700",
  stopped: "bg-gray-100 text-gray-700",
  bounced: "bg-red-50 text-red-700",
  completed: "bg-emerald-50 text-emerald-700",
};

interface ContactProgressTableProps {
  campaignId: string;
  totalSteps: number;
}

export function ContactProgressTable({ campaignId, totalSteps }: ContactProgressTableProps) {
  const [stopContactId, setStopContactId] = useState<string | null>(null);
  const [stopLoading, setStopLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { data: contactsData, isLoading, mutate: mutateContacts } = useSWR<
    PaginatedResponse<CampaignContact>
  >(
    `/campaigns/${campaignId}/contacts?per_page=100`,
    (url: string) => apiGet<PaginatedResponse<CampaignContact>>(url),
    { refreshInterval: 30000 }
  );
  const contacts = contactsData?.items ?? [];

  const { data: progressData } = useSWR<ApiResponse<CampaignProgress>>(
    `/campaigns/${campaignId}/progress`,
    (url: string) => apiGet<ApiResponse<CampaignProgress>>(url),
    { refreshInterval: 30000 }
  );

  // Update lastRefresh on data change
  useEffect(() => {
    if (contactsData) {
      setLastRefresh(new Date());
    }
  }, [contactsData]);

  const handleRefresh = useCallback(() => {
    mutateContacts();
    setLastRefresh(new Date());
  }, [mutateContacts]);

  const handleStopSequence = async () => {
    if (!stopContactId) return;
    setStopLoading(true);
    try {
      await apiPost(`/campaigns/${campaignId}/contacts/${stopContactId}/stop`);
      mutateContacts();
      setStopContactId(null);
    } catch {
      // Error handled by UI
    } finally {
      setStopLoading(false);
    }
  };

  const stepsCount = totalSteps || progressData?.data?.stepsCompletion?.length || 1;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-14 rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
        <Users className="h-8 w-8 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">
          No contacts added to this campaign yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {contacts.length} contact{contacts.length !== 1 ? "s" : ""} in campaign
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Contact
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Company
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Current Step
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Progress
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Added
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((contact) => {
                const isReplied = contact.status === "replied";
                const isStopped = contact.status === "stopped";
                const stepProgress = Math.min(
                  ((contact.currentStep || 0) / stepsCount) * 100,
                  100
                );

                return (
                  <tr
                    key={contact.contactId}
                    className={cn(
                      "transition-colors",
                      isReplied && "bg-green-50/40",
                      isStopped && "bg-gray-50/60"
                    )}
                  >
                    {/* Name with avatar */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                          {getInitials(contact.contactName)}
                        </div>
                        <span className="font-medium text-gray-900">
                          {contact.contactName}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3.5 text-sm text-gray-700">
                      {contact.contactEmail}
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3.5 text-sm text-gray-700">
                      {contact.companyName || (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>

                    {/* Current Step */}
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium text-gray-700">
                        Step {contact.currentStep || 1} of {stepsCount}
                      </span>
                    </td>

                    {/* Progress bar */}
                    <td className="px-4 py-3.5">
                      <div className="w-24">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isReplied
                                ? "bg-green-500"
                                : isStopped
                                ? "bg-gray-400"
                                : "bg-blue-500"
                            )}
                            style={{ width: `${stepProgress}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        status={contact.status}
                        variantMap={contactStatusVariants}
                      />
                    </td>

                    {/* Added */}
                    <td className="px-4 py-3.5 text-sm text-gray-500">
                      {formatDate(contact.addedAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {contact.status === "active" && (
                          <button
                            onClick={() => setStopContactId(contact.contactId)}
                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Stop Sequence"
                          >
                            <StopCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                          title="View Messages"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stop Sequence Confirmation Modal */}
      <Modal
        isOpen={!!stopContactId}
        onClose={() => setStopContactId(null)}
        title="Stop Sequence"
        footer={
          <>
            <Button variant="outline" onClick={() => setStopContactId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleStopSequence}
              isLoading={stopLoading}
            >
              <StopCircle className="mr-1.5 h-3.5 w-3.5" />
              Stop Sequence
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to stop the sequence for this contact? No further
          messages will be sent to them in this campaign. This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
