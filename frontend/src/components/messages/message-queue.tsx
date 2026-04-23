"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  ChevronDown,
  ChevronUp,
  Check,
  Send,
  Sparkles,
  Mail,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { ToneBadge } from "@/components/messages/tone-badge";
import { apiGet, apiPost } from "@/lib/api-client";
import { formatDateTime, truncate, cn } from "@/lib/utils";
import type { MessageDraft, MessageStatus } from "@/types/models";
import type { ApiResponse } from "@/types/api";

const messageStatusVariants: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-yellow-50 text-yellow-700",
  approved: "bg-blue-50 text-blue-700",
  sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  replied: "bg-purple-50 text-purple-700",
  bounced: "bg-orange-50 text-orange-700",
};

interface StepGroup {
  stepNumber: number;
  delayDays: number;
  stepId: string;
  messages: MessageDraft[];
}

interface MessageQueueProps {
  campaignId: string;
}

export function MessageQueue({ campaignId }: MessageQueueProps) {
  const router = useRouter();
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(
    new Set([1])
  );
  const [generateLoading, setGenerateLoading] = useState<string | null>(null);
  const [approveAllLoading, setApproveAllLoading] = useState<string | null>(null);
  const [sendAllLoading, setSendAllLoading] = useState<string | null>(null);

  const { data, isLoading } = useSWR<
    ApiResponse<{ steps: StepGroup[] }>
  >(`/campaigns/${campaignId}/messages`, (url: string) =>
    apiGet<ApiResponse<{ steps: StepGroup[] }>>(url)
  );

  const steps = data?.data?.steps ?? [];

  // Compute progress summary
  const allMessages = steps.flatMap((s) => s.messages);
  const counts = {
    draft: allMessages.filter((m) => m.status === "draft").length,
    pending: allMessages.filter((m) => m.status === "pending_approval").length,
    approved: allMessages.filter((m) => m.status === "approved").length,
    sent: allMessages.filter((m) => m.status === "sent").length,
    failed: allMessages.filter((m) => m.status === "failed").length,
  };

  const toggleStep = (stepNumber: number) => {
    const next = new Set(expandedSteps);
    if (next.has(stepNumber)) {
      next.delete(stepNumber);
    } else {
      next.add(stepNumber);
    }
    setExpandedSteps(next);
  };

  const handleGenerateMessages = async (stepId: string) => {
    setGenerateLoading(stepId);
    try {
      await apiPost(`/campaigns/${campaignId}/steps/${stepId}/generate`);
      mutate(`/campaigns/${campaignId}/messages`);
    } catch {
      // Error handling via UI
    } finally {
      setGenerateLoading(null);
    }
  };

  const handleApproveAll = async (stepId: string) => {
    setApproveAllLoading(stepId);
    try {
      await apiPost(`/campaigns/${campaignId}/steps/${stepId}/approve-all`);
      mutate(`/campaigns/${campaignId}/messages`);
    } catch {
      // Error handling via UI
    } finally {
      setApproveAllLoading(null);
    }
  };

  const handleSendAllApproved = async (stepId: string) => {
    setSendAllLoading(stepId);
    try {
      await apiPost(`/campaigns/${campaignId}/steps/${stepId}/send-all`);
      mutate(`/campaigns/${campaignId}/messages`);
    } catch {
      // Error handling via UI
    } finally {
      setSendAllLoading(null);
    }
  };

  const columns: Column<MessageDraft>[] = [
    {
      key: "subject",
      label: "Subject",
      render: (item) => (
        <div>
          <p className="font-medium text-gray-900">
            {truncate(item.subject, 50)}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {item.contactName ?? "Unknown Contact"}
          </p>
        </div>
      ),
    },
    {
      key: "contactEmail",
      label: "Email",
      render: (item) => (
        <span className="text-sm text-gray-700">{item.contactEmail}</span>
      ),
    },
    {
      key: "tone",
      label: "Tone",
      render: (item) => <ToneBadge tone={item.tone} />,
    },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <StatusBadge
          status={item.status}
          variantMap={messageStatusVariants}
        />
      ),
    },
    {
      key: "scheduledFor",
      label: "Scheduled",
      render: (item) =>
        item.scheduledFor ? (
          <span className="text-xs text-gray-600">
            {formatDateTime(item.scheduledFor)}
          </span>
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-14 rounded-xl bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Summary */}
      <div className="grid grid-cols-5 gap-3">
        {[
          {
            label: "Drafts",
            count: counts.draft,
            icon: Mail,
            color: "bg-gray-100 text-gray-700",
          },
          {
            label: "Pending",
            count: counts.pending,
            icon: Clock,
            color: "bg-yellow-50 text-yellow-700",
          },
          {
            label: "Approved",
            count: counts.approved,
            icon: Check,
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Sent",
            count: counts.sent,
            icon: Send,
            color: "bg-green-50 text-green-700",
          },
          {
            label: "Failed",
            count: counts.failed,
            icon: AlertTriangle,
            color: "bg-red-50 text-red-700",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5",
                stat.color
              )}
            >
              <Icon className="h-4 w-4" />
              <div>
                <p className="text-lg font-bold">{stat.count}</p>
                <p className="text-xs font-medium">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Steps */}
      {steps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
          <Mail className="h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No message steps found for this campaign.
          </p>
        </div>
      ) : (
        steps.map((step) => {
          const isExpanded = expandedSteps.has(step.stepNumber);
          const pendingCount = step.messages.filter(
            (m) => m.status === "pending_approval"
          ).length;
          const approvedCount = step.messages.filter(
            (m) => m.status === "approved"
          ).length;

          return (
            <div
              key={step.stepNumber}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {/* Step Header */}
              <button
                onClick={() => toggleStep(step.stepNumber)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                    {step.stepNumber}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">
                      Step {step.stepNumber} &mdash; Day {step.delayDays}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {step.messages.length} message
                      {step.messages.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                      {pendingCount} pending
                    </span>
                  )}
                  {approvedCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {approvedCount} approved
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Step Content */}
              {isExpanded && (
                <div className="border-t border-gray-200">
                  {/* Actions */}
                  <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateMessages(step.stepId)}
                      isLoading={generateLoading === step.stepId}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5 text-purple-500" />
                      Generate Messages
                    </Button>
                    {pendingCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApproveAll(step.stepId)}
                        isLoading={approveAllLoading === step.stepId}
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                        Approve All ({pendingCount})
                      </Button>
                    )}
                    {approvedCount > 0 && (
                      <Button
                        size="sm"
                        onClick={() => handleSendAllApproved(step.stepId)}
                        isLoading={sendAllLoading === step.stepId}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Send All Approved ({approvedCount})
                      </Button>
                    )}
                  </div>

                  {/* Messages Table */}
                  {step.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <Mail className="h-6 w-6" />
                      <p className="mt-2 text-sm">
                        No messages generated for this step yet.
                      </p>
                    </div>
                  ) : (
                    <DataTable
                      columns={columns}
                      data={step.messages}
                      keyField="id"
                      onRowClick={(item) =>
                        router.push(
                          `/dashboard/messages/${
                            (item as unknown as MessageDraft).id
                          }`
                        )
                      }
                      className="border-0 rounded-none shadow-none"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
