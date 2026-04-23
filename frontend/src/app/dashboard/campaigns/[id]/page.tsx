"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  ArrowLeft,
  Edit,
  Play,
  Pause,
  Shield,
  Archive,
  Trash2,
  MoreVertical,
  Plus,
  Users,
  ListChecks,
  Activity,
  LayoutDashboard,
  Sparkles,
  RefreshCw,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/common/status-badge";
import { DataTable, type Column } from "@/components/common/data-table";
import { CampaignStatusPanel } from "@/components/campaigns/campaign-status-panel";
import { SequenceTimeline } from "@/components/campaigns/sequence-timeline";
import { CampaignLiveControls } from "@/components/campaigns/campaign-live-controls";
import { CampaignStatsRow } from "@/components/campaigns/campaign-stats-row";
import { CampaignProgressBar } from "@/components/campaigns/campaign-progress-bar";
import { StepCompletionChart } from "@/components/campaigns/step-completion-chart";
import { ContactProgressTable } from "@/components/campaigns/contact-progress-table";
import { apiGet, apiPatch, apiDelete } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";
import type {
  Campaign,
  SequenceStep,
  CampaignContact,
  CampaignProgress,
} from "@/types/models";
import type { ApiResponse } from "@/types/api";

const campaignTypeVariants: Record<string, string> = {
  intro: "bg-blue-50 text-blue-700",
  follow_up: "bg-purple-50 text-purple-700",
  mice: "bg-emerald-50 text-emerald-700",
  corporate: "bg-indigo-50 text-indigo-700",
  custom: "bg-gray-100 text-gray-700",
};

const campaignStatusVariants: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-50 text-green-700",
  paused: "bg-yellow-50 text-yellow-700",
  completed: "bg-blue-50 text-blue-700",
  archived: "bg-amber-50 text-amber-700",
};

const toneLabels: Record<string, string> = {
  formal: "Formal",
  friendly: "Friendly",
  consultative: "Consultative",
  aggressive: "Aggressive",
};

type TabId = "overview" | "contacts" | "sequence" | "activity";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "sequence", label: "Sequence", icon: ListChecks },
  { id: "activity", label: "Activity", icon: Activity },
];

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showActions, setShowActions] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch campaign
  const { data: campaignData, isLoading } = useSWR<ApiResponse<Campaign>>(
    `/campaigns/${campaignId}`,
    (url: string) => apiGet<ApiResponse<Campaign>>(url),
    { refreshInterval: 30000 }
  );
  const campaign = campaignData?.data;

  // Fetch steps
  const { data: stepsData } = useSWR<ApiResponse<SequenceStep[]>>(
    campaign ? `/campaigns/${campaignId}/steps` : null,
    (url: string) => apiGet<ApiResponse<SequenceStep[]>>(url)
  );
  const steps = stepsData?.data ?? [];

  // Fetch progress
  const { data: progressData } = useSWR<ApiResponse<CampaignProgress>>(
    campaign ? `/campaigns/${campaignId}/progress` : null,
    (url: string) => apiGet<ApiResponse<CampaignProgress>>(url),
    { refreshInterval: 30000 }
  );
  const progress = progressData?.data;

  // Update lastUpdated on data refresh
  useEffect(() => {
    if (campaignData) {
      setLastUpdated(new Date());
    }
  }, [campaignData]);

  const handleRefresh = useCallback(() => {
    mutate(`/campaigns/${campaignId}`);
    mutate(`/campaigns/${campaignId}/steps`);
    mutate(`/campaigns/${campaignId}/progress`);
    mutate(`/campaigns/${campaignId}/contacts`);
    setLastUpdated(new Date());
  }, [campaignId]);

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiPatch(`/campaigns/${campaignId}`, { status: newStatus });
      mutate(`/campaigns/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await apiPatch(`/campaigns/${campaignId}/approve`);
      mutate(`/campaigns/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await apiDelete(`/campaigns/${campaignId}`);
      router.push("/dashboard/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleteLoading(false);
    }
  };

  // Time since last update
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-gray-200" />
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="h-12 w-full rounded-xl bg-gray-100" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-100" />
            ))}
          </div>
          <div className="flex gap-6">
            <div className="h-96 flex-[2] rounded-xl bg-gray-100" />
            <div className="h-96 flex-1 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-lg font-semibold text-gray-900">Campaign not found</h2>
        <p className="mt-1 text-sm text-gray-500">
          The campaign you are looking for does not exist or was deleted.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard/campaigns")}
        >
          Back to Campaigns
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Campaign Banner */}
      {campaign.status === "active" && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3">
          <div className="relative">
            <Radio className="h-5 w-5 text-green-600" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-green-400" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-green-500" />
          </div>
          <span className="text-sm font-medium text-green-700">
            Campaign is running &mdash; messages are being sent according to the sequence schedule
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-green-600">
              Updated {secondsAgo}s ago
            </span>
            <button
              onClick={handleRefresh}
              className="rounded-md p-1 text-green-600 transition-colors hover:bg-green-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/campaigns")}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {campaign.name}
              </h1>
              <StatusBadge
                status={campaign.campaignType}
                variantMap={campaignTypeVariants}
              />
              <StatusBadge
                status={campaign.status}
                variantMap={campaignStatusVariants}
              />
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {toneLabels[campaign.tonePreset] ?? campaign.tonePreset}
              </span>
            </div>
            {campaign.description && (
              <p className="mt-1 text-sm text-gray-500">
                {campaign.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/dashboard/campaigns/${campaignId}/sequences`)
              }
            >
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            {!campaign.approvedBy && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleApprove}
                isLoading={actionLoading}
              >
                <Shield className="mr-1.5 h-3.5 w-3.5" />
                Approve
              </Button>
            )}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActions(!showActions)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              {showActions && (
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      setShowActions(false);
                      handleStatusChange("archived");
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Archive className="h-4 w-4" />
                    Archive
                  </button>
                  <button
                    onClick={() => {
                      setShowActions(false);
                      setIsDeleteOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Controls */}
      <CampaignLiveControls
        campaign={campaign}
        onStatusChange={handleStatusChange}
      />

      {/* Stats Row */}
      <CampaignStatsRow campaignId={campaignId} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Auto-refresh indicator */}
        <div className="flex items-center gap-2 pb-2">
          <span className="text-xs text-gray-400">
            Last updated: {secondsAgo}s ago
          </span>
          <button
            onClick={handleRefresh}
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Refresh data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Campaign Progress Bar */}
              {progress && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                    Campaign Progress
                  </h3>
                  <CampaignProgressBar progress={progress} />
                  <p className="mt-3 text-xs text-gray-500">
                    {campaign.stepCount} steps across {campaign.contactCount}{" "}
                    contacts
                  </p>
                </div>
              )}

              {/* Fallback progress when no progress data */}
              {!progress && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                    Campaign Progress
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-3 w-full rounded-full bg-gray-100">
                        <div
                          className="h-3 rounded-full bg-primary-500 transition-all"
                          style={{ width: "0%" }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">0%</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {campaign.stepCount} steps across {campaign.contactCount}{" "}
                    contacts
                  </p>
                </div>
              )}

              {/* Step Completion Chart */}
              {progress && progress.stepsCompletion.length > 0 && (
                <StepCompletionChart
                  stepsCompletion={progress.stepsCompletion}
                />
              )}

              {/* Campaign Info */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                  Campaign Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Type:</span>{" "}
                    <span className="font-medium capitalize text-gray-900">
                      {campaign.campaignType.replace("_", " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tone:</span>{" "}
                    <span className="font-medium text-gray-900">
                      {toneLabels[campaign.tonePreset] ?? campaign.tonePreset}
                    </span>
                  </div>
                  {campaign.strategyName && (
                    <div>
                      <span className="text-gray-500">Strategy:</span>{" "}
                      <button
                        onClick={() =>
                          campaign.strategyId &&
                          router.push(
                            `/dashboard/strategies/${campaign.strategyId}`
                          )
                        }
                        className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                      >
                        {campaign.strategyName}
                      </button>
                    </div>
                  )}
                  {campaign.startsAt && (
                    <div>
                      <span className="text-gray-500">Starts:</span>{" "}
                      <span className="font-medium text-gray-900">
                        {formatDate(campaign.startsAt)}
                      </span>
                    </div>
                  )}
                  {campaign.endsAt && (
                    <div>
                      <span className="text-gray-500">Ends:</span>{" "}
                      <span className="font-medium text-gray-900">
                        {formatDate(campaign.endsAt)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Created:</span>{" "}
                    <span className="font-medium text-gray-900">
                      {formatDate(campaign.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === "contacts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Campaign Contacts ({campaign.contactCount})
                </h3>
                <Button variant="outline" size="sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Contacts
                </Button>
              </div>

              <ContactProgressTable
                campaignId={campaignId}
                totalSteps={campaign.stepCount}
              />
            </div>
          )}

          {/* Sequence Tab */}
          {activeTab === "sequence" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Sequence Steps ({steps.length})
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Generate AI Messages
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/dashboard/campaigns/${campaignId}/sequences`
                      )
                    }
                  >
                    <Edit className="mr-1.5 h-3.5 w-3.5" />
                    Edit Sequence
                  </Button>
                </div>
              </div>

              <SequenceTimeline steps={steps} editable={false} />
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Activity Log
              </h3>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
                    <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                      <div className="h-2 w-2 rounded-full bg-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Campaign created
                      </p>
                      <p className="text-xs text-gray-500">
                        {campaign.name} was created
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {formatDate(campaign.createdAt)}
                      </p>
                    </div>
                  </div>
                  {campaign.approvedAt && (
                    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <div className="h-2 w-2 rounded-full bg-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Campaign approved
                        </p>
                        <p className="text-xs text-gray-500">
                          Approved by manager
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {formatDate(campaign.approvedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  {campaign.status === "active" && (
                    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                        <div className="relative h-2 w-2 rounded-full bg-green-600">
                          <span className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-75" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Campaign is currently active
                        </p>
                        <p className="text-xs text-gray-500">
                          Messages are being sent according to the sequence schedule
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div>
          <CampaignStatusPanel campaign={campaign} />
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Campaign"
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
              Delete Campaign
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete &ldquo;{campaign.name}&rdquo;? This
          will remove the campaign and all associated sequences and contacts
          permanently.
        </p>
      </Modal>
    </div>
  );
}
