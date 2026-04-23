"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  ArrowLeft,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Building2,
  Megaphone,
  Check,
  X,
  AlertTriangle,
  MessageSquare,
  Eye,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/common/status-badge";
import { MessagePreview } from "@/components/messages/message-preview";
import { MessageEditor } from "@/components/messages/message-editor";
import { ApprovalButtons } from "@/components/messages/approval-buttons";
import { ToneBadge } from "@/components/messages/tone-badge";
import { RegenerateModal } from "@/components/messages/regenerate-modal";
import { ScheduleModal } from "@/components/messages/schedule-modal";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { MessageStatus } from "@/types/models";
import type { MessageDraft } from "@/types/models";
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

const largeStatusVariants: Record<string, string> = {
  draft: "border-gray-300 bg-gray-50 text-gray-700",
  pending_approval: "border-yellow-300 bg-yellow-50 text-yellow-700",
  approved: "border-blue-300 bg-blue-50 text-blue-700",
  sent: "border-green-300 bg-green-50 text-green-700",
  failed: "border-red-300 bg-red-50 text-red-700",
  replied: "border-purple-300 bg-purple-50 text-purple-700",
  bounced: "border-orange-300 bg-orange-50 text-orange-700",
};

export default function MessageDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const messageId = params.id as string;

  const [isEditing, setIsEditing] = useState(
    searchParams.get("edit") === "true"
  );
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [markRepliedLoading, setMarkRepliedLoading] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Fetch message
  const { data, isLoading } = useSWR<ApiResponse<MessageDraft>>(
    `/messages/${messageId}`,
    (url: string) => apiGet<ApiResponse<MessageDraft>>(url)
  );
  const message = data?.data;

  // Populate editor when message loads
  useEffect(() => {
    if (message) {
      setEditSubject(message.subject);
      setEditBody(message.body);
    }
  }, [message]);

  const handleSave = async () => {
    setSaveLoading(true);
    setError(null);
    try {
      await apiPatch(`/messages/${messageId}`, {
        subject: editSubject,
        body: editBody,
      });
      setIsEditing(false);
      mutate(`/messages/${messageId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save message");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setSubmitLoading(true);
    setError(null);
    try {
      await apiPost(`/messages/${messageId}/submit`);
      mutate(`/messages/${messageId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit for approval"
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await apiDelete(`/messages/${messageId}`);
      router.push("/dashboard/messages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleteLoading(false);
    }
  };

  const handleReject = async () => {
    setRejectLoading(true);
    setError(null);
    try {
      await apiPost(`/messages/${messageId}/reject`, {
        feedback: rejectFeedback,
      });
      setIsRejectOpen(false);
      setRejectFeedback("");
      mutate(`/messages/${messageId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setRejectLoading(false);
    }
  };

  const handleEditFromApproved = () => {
    setIsEditing(true);
    // Reopening as draft by setting status back
  };

  const handleMarkReplied = async () => {
    setMarkRepliedLoading(true);
    setError(null);
    try {
      await apiPatch(`/messages/${messageId}`, { status: "replied" });
      mutate(`/messages/${messageId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark as replied"
      );
    } finally {
      setMarkRepliedLoading(false);
    }
  };

  const handleStatusChange = () => {
    mutate(`/messages/${messageId}`);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-gray-200" />
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="flex gap-6">
            <div className="h-96 flex-[2] rounded-xl bg-gray-100" />
            <div className="h-96 flex-1 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-lg font-semibold text-gray-900">
          Message not found
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          The message you are looking for does not exist or was deleted.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard/messages")}
        >
          Back to Messages
        </Button>
      </div>
    );
  }

  const statusLabel = message.status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/messages")}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Messages
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? "Edit Message" : "Message Detail"}
              </h1>
              <StatusBadge
                status={message.status}
                variantMap={messageStatusVariants}
              />
              <ToneBadge tone={message.tone} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              To: {message.contactName ?? "Unknown"}{" "}
              {message.contactEmail && `<${message.contactEmail}>`}
            </p>
          </div>

          {isEditing && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditSubject(message.subject);
                  setEditBody(message.body);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} isLoading={saveLoading}>
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column (2/3) — Message content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Email Preview / Editor */}
          {isEditing ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <MessageEditor
                subject={editSubject}
                body={editBody}
                onSubjectChange={setEditSubject}
                onBodyChange={setEditBody}
              />
            </div>
          ) : (
            <MessagePreview
              subject={message.subject}
              body={message.body}
              contactName={message.contactName}
              contactEmail={message.contactEmail}
              tone={message.tone}
              variantLabel={message.variantLabel}
            />
          )}

          {/* Context Panel (collapsible) */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <button
              onClick={() => setContextExpanded(!contextExpanded)}
              className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
            >
              <h3 className="text-sm font-semibold text-gray-700">
                Generation Context
              </h3>
              {contextExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {contextExpanded && (
              <div className="border-t border-gray-200 px-6 py-4">
                <div className="space-y-4">
                  {/* Company info */}
                  {message.companyName && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                        Company
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {message.companyName}
                      </p>
                    </div>
                  )}

                  {/* Context data */}
                  {message.contextData && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                        Research Context Used
                      </p>
                      <div className="mt-1 space-y-1">
                        {Object.entries(message.contextData).map(
                          ([key, value]) => (
                            <div key={key} className="text-sm">
                              <span className="font-medium text-gray-600">
                                {key.replace(/_/g, " ")}:
                              </span>{" "}
                              <span className="text-gray-700">
                                {typeof value === "string"
                                  ? value
                                  : JSON.stringify(value)}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {!message.contextData && !message.companyName && (
                    <p className="text-sm text-gray-400">
                      No generation context available.
                    </p>
                  )}

                  {/* Sequence Position */}
                  {message.sequenceStepId && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                        Sequence Position
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        Part of campaign sequence
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column (1/3) — Actions & metadata */}
        <div className="space-y-6">
          {/* Status Badge (large) */}
          <div
            className={cn(
              "flex items-center justify-center rounded-xl border-2 px-4 py-5",
              largeStatusVariants[message.status] ??
                "border-gray-300 bg-gray-50 text-gray-700"
            )}
          >
            <p className="text-lg font-bold">{statusLabel}</p>
          </div>

          {/* Action Buttons */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Actions
            </h3>

            {/* Draft actions */}
            {message.status === MessageStatus.DRAFT && (
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  className="w-full"
                  onClick={handleSubmitForApproval}
                  isLoading={submitLoading}
                >
                  <Send className="mr-1.5 h-4 w-4" />
                  Submit for Approval
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsRegenerateOpen(true)}
                >
                  <Sparkles className="mr-1.5 h-4 w-4 text-purple-500" />
                  Regenerate
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}

            {/* Pending Approval actions */}
            {message.status === MessageStatus.PENDING_APPROVAL && (
              <div className="space-y-3">
                <ApprovalButtons
                  messageId={messageId}
                  currentStatus={message.status}
                  onStatusChange={handleStatusChange}
                />
                <div className="border-t border-gray-100 pt-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              </div>
            )}

            {/* Approved actions */}
            {message.status === MessageStatus.APPROVED && (
              <div className="flex flex-col gap-2">
                <ApprovalButtons
                  messageId={messageId}
                  currentStatus={message.status}
                  onStatusChange={handleStatusChange}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsScheduleOpen(true)}
                >
                  <Calendar className="mr-1.5 h-4 w-4" />
                  Schedule
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={handleEditFromApproved}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit (reopen as draft)
                </Button>
              </div>
            )}

            {/* Sent actions */}
            {message.status === MessageStatus.SENT && (
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="w-full" disabled>
                  <Eye className="mr-1.5 h-4 w-4" />
                  View Tracking
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleMarkReplied}
                  isLoading={markRepliedLoading}
                >
                  <MessageSquare className="mr-1.5 h-4 w-4" />
                  Mark as Replied
                </Button>
              </div>
            )}

            {/* Failed actions */}
            {message.status === MessageStatus.FAILED && (
              <div className="flex flex-col gap-2">
                <ApprovalButtons
                  messageId={messageId}
                  currentStatus={message.status}
                  onStatusChange={handleStatusChange}
                />
                {message.errorMessage && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs font-medium text-red-700">Error</p>
                    <p className="mt-0.5 text-xs text-red-600">
                      {message.errorMessage}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Replied / Bounced — no actions */}
            {(message.status === MessageStatus.REPLIED ||
              message.status === MessageStatus.BOUNCED) && (
              <p className="text-sm text-gray-500">
                No actions available for this status.
              </p>
            )}
          </div>

          {/* Metadata Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Metadata
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Created by</span>
                <span className="font-medium text-gray-900">
                  {message.createdBy}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-700">
                  {formatDate(message.createdAt)}
                </span>
              </div>
              {message.approvedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Approved by</span>
                  <span className="font-medium text-gray-900">
                    {message.approvedBy}
                  </span>
                </div>
              )}
              {message.approvedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Approved at</span>
                  <span className="text-gray-700">
                    {formatDateTime(message.approvedAt)}
                  </span>
                </div>
              )}
              {message.sentAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Sent at</span>
                  <span className="text-gray-700">
                    {formatDateTime(message.sentAt)}
                  </span>
                </div>
              )}
              {message.scheduledFor && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Scheduled for</span>
                  <span className="font-medium text-primary-700">
                    {formatDateTime(message.scheduledFor)}
                  </span>
                </div>
              )}
              {message.openedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Opened at</span>
                  <span className="text-gray-700">
                    {formatDateTime(message.openedAt)}
                  </span>
                </div>
              )}
              {message.repliedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Replied at</span>
                  <span className="text-gray-700">
                    {formatDateTime(message.repliedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Campaign Info Card */}
          {message.campaignName && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Campaign
              </h3>
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-gray-400" />
                <button
                  onClick={() =>
                    router.push(`/dashboard/campaigns/${message.campaignId}`)
                  }
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {message.campaignName}
                </button>
              </div>
            </div>
          )}

          {/* Sequence Position */}
          {message.sequenceStepId && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Sequence Position
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                  S
                </div>
                <span className="text-sm text-gray-700">
                  Part of automated sequence
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Message"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={deleteLoading}
            >
              Delete Message
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this message? This action cannot be
          undone.
        </p>
      </Modal>

      {/* Regenerate Modal */}
      <RegenerateModal
        messageId={messageId}
        currentTone={message.tone}
        isOpen={isRegenerateOpen}
        onClose={() => setIsRegenerateOpen(false)}
        onRegenerated={() => mutate(`/messages/${messageId}`)}
      />

      {/* Schedule Modal */}
      <ScheduleModal
        messageId={messageId}
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        onScheduled={() => mutate(`/messages/${messageId}`)}
      />
    </div>
  );
}
