"use client";

import { useState } from "react";
import {
  Check,
  X,
  Send,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiPost } from "@/lib/api-client";
import { MessageStatus } from "@/types/models";

interface ApprovalButtonsProps {
  messageId: string;
  currentStatus: MessageStatus;
  onStatusChange: () => void;
}

export function ApprovalButtons({
  messageId,
  currentStatus,
  onStatusChange,
}: ApprovalButtonsProps) {
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [regenerateLoading, setRegenerateLoading] = useState(false);

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isSendConfirmOpen, setIsSendConfirmOpen] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleApprove = async () => {
    setApproveLoading(true);
    try {
      await apiPost(`/messages/${messageId}/approve`);
      showFeedback("success", "Message approved successfully");
      onStatusChange();
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Failed to approve message"
      );
    } finally {
      setApproveLoading(false);
    }
  };

  const handleReject = async () => {
    setRejectLoading(true);
    try {
      await apiPost(`/messages/${messageId}/reject`, {
        feedback: rejectFeedback,
      });
      showFeedback("success", "Message rejected");
      setIsRejectOpen(false);
      setRejectFeedback("");
      onStatusChange();
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Failed to reject message"
      );
    } finally {
      setRejectLoading(false);
    }
  };

  const handleSend = async () => {
    setSendLoading(true);
    try {
      await apiPost(`/messages/${messageId}/send`);
      showFeedback("success", "Message sent successfully");
      setIsSendConfirmOpen(false);
      onStatusChange();
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Failed to send message"
      );
    } finally {
      setSendLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerateLoading(true);
    try {
      await apiPost(`/messages/${messageId}/regenerate`);
      showFeedback("success", "Message regenerated");
      onStatusChange();
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Failed to regenerate message"
      );
    } finally {
      setRegenerateLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Feedback toast */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Context-dependent buttons */}
      {currentStatus === MessageStatus.PENDING_APPROVAL && (
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={handleApprove}
            isLoading={approveLoading}
          >
            <Check className="mr-1.5 h-4 w-4" />
            Approve
          </Button>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => setIsRejectOpen(true)}
          >
            <X className="mr-1.5 h-4 w-4" />
            Reject
          </Button>
        </div>
      )}

      {currentStatus === MessageStatus.APPROVED && (
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
          onClick={() => setIsSendConfirmOpen(true)}
        >
          <Send className="mr-1.5 h-4 w-4" />
          Send Now
        </Button>
      )}

      {currentStatus === MessageStatus.FAILED && (
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
          onClick={() => setIsSendConfirmOpen(true)}
        >
          <Send className="mr-1.5 h-4 w-4" />
          Retry Send
        </Button>
      )}

      {/* Regenerate always available except sent/replied */}
      {currentStatus !== MessageStatus.SENT &&
        currentStatus !== MessageStatus.REPLIED && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRegenerate}
            isLoading={regenerateLoading}
          >
            <Sparkles className="mr-1.5 h-4 w-4 text-purple-500" />
            Regenerate
          </Button>
        )}

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectOpen}
        onClose={() => {
          setIsRejectOpen(false);
          setRejectFeedback("");
        }}
        title="Reject Message"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectOpen(false);
                setRejectFeedback("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              isLoading={rejectLoading}
              disabled={!rejectFeedback.trim()}
            >
              Reject Message
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Provide feedback on why this message should be revised.
          </p>
          <textarea
            value={rejectFeedback}
            onChange={(e) => setRejectFeedback(e.target.value)}
            placeholder="What should be changed?"
            rows={4}
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </Modal>

      {/* Send Confirmation Modal */}
      <Modal
        isOpen={isSendConfirmOpen}
        onClose={() => setIsSendConfirmOpen(false)}
        title="Send Message"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsSendConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} isLoading={sendLoading}>
              <Send className="mr-1.5 h-4 w-4" />
              Confirm Send
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
            <Send className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">
              Are you sure you want to send this message now? This action cannot
              be undone.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
