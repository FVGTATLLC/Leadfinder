"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  Archive,
  ArchiveRestore,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Users,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/types/models";

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; dotColor: string; pulse?: boolean }
> = {
  draft: {
    label: "Draft",
    color: "text-gray-700",
    bgColor: "bg-gray-50 border-gray-200",
    dotColor: "bg-gray-400",
  },
  active: {
    label: "Running",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    dotColor: "bg-green-500",
    pulse: true,
  },
  paused: {
    label: "Paused",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200",
    dotColor: "bg-yellow-500",
  },
  completed: {
    label: "Completed",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    dotColor: "bg-blue-500",
  },
  archived: {
    label: "Archived",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
    dotColor: "bg-amber-500",
  },
};

interface CampaignLiveControlsProps {
  campaign: Campaign;
  onStatusChange: (newStatus: string) => Promise<void>;
}

export function CampaignLiveControls({
  campaign,
  onStatusChange,
}: CampaignLiveControlsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [flashColor, setFlashColor] = useState<string | null>(null);

  const config = statusConfig[campaign.status] ?? statusConfig.draft;

  const handleStatusTransition = async (newStatus: string) => {
    setIsLoading(true);
    try {
      await onStatusChange(newStatus);
      // Flash animation
      const newConfig = statusConfig[newStatus];
      if (newConfig) {
        setFlashColor(newConfig.bgColor);
        setTimeout(() => setFlashColor(null), 600);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateClick = () => {
    // Show confirmation with checklist
    setShowActivateModal(true);
  };

  const handleConfirmActivate = async () => {
    setShowActivateModal(false);
    await handleStatusTransition("active");
  };

  const hasContacts = campaign.contactCount > 0;
  const hasSteps = campaign.stepCount > 0;
  const canActivate = hasContacts && hasSteps;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-300",
          flashColor ?? config.bgColor
        )}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className={cn("h-2.5 w-2.5 rounded-full", config.dotColor)} />
            {config.pulse && (
              <div
                className={cn(
                  "absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full opacity-75",
                  config.dotColor
                )}
              />
            )}
          </div>
          <span className={cn("text-sm font-semibold", config.color)}>
            {config.label}
          </span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <Button
              size="sm"
              onClick={handleActivateClick}
              isLoading={isLoading}
              disabled={!canActivate}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Activate Campaign
            </Button>
          )}

          {campaign.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusTransition("paused")}
              isLoading={isLoading}
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            >
              <Pause className="mr-1.5 h-3.5 w-3.5" />
              Pause Campaign
            </Button>
          )}

          {campaign.status === "paused" && (
            <>
              <Button
                size="sm"
                onClick={() => handleStatusTransition("active")}
                isLoading={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Resume Campaign
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusTransition("archived")}
                isLoading={isLoading}
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Archive
              </Button>
            </>
          )}

          {campaign.status === "completed" && (
            <>
              <Button variant="outline" size="sm">
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                View Results
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusTransition("archived")}
                isLoading={isLoading}
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Archive
              </Button>
            </>
          )}

          {campaign.status === "archived" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusTransition("draft")}
              isLoading={isLoading}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
              Unarchive
            </Button>
          )}
        </div>
      </div>

      {/* Activate Confirmation Modal */}
      <Modal
        isOpen={showActivateModal}
        onClose={() => setShowActivateModal(false)}
        title="Activate Campaign"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowActivateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmActivate}
              disabled={!canActivate}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Activate Campaign
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please review the checklist below before activating the campaign.
            Once activated, messages will start being sent according to the
            sequence schedule.
          </p>

          <div className="space-y-2.5 rounded-lg border border-gray-200 bg-gray-50 p-4">
            {/* Contacts check */}
            <div className="flex items-center gap-2.5">
              {hasContacts ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              )}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span
                  className={cn(
                    "text-sm font-medium",
                    hasContacts ? "text-gray-700" : "text-red-600"
                  )}
                >
                  {hasContacts
                    ? `${campaign.contactCount} contacts added`
                    : "No contacts added — add contacts first"}
                </span>
              </div>
            </div>

            {/* Steps check */}
            <div className="flex items-center gap-2.5">
              {hasSteps ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              )}
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-gray-400" />
                <span
                  className={cn(
                    "text-sm font-medium",
                    hasSteps ? "text-gray-700" : "text-red-600"
                  )}
                >
                  {hasSteps
                    ? `${campaign.stepCount} sequence steps configured`
                    : "No sequence steps — add steps first"}
                </span>
              </div>
            </div>
          </div>

          {!canActivate && (
            <p className="text-xs text-red-600">
              All items above must be completed before activating the campaign.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
