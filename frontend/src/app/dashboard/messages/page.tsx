"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  Mail,
  Eye,
  Pencil,
  Check,
  Send,
  Sparkles,
  MoreHorizontal,
  Inbox,
  Clock,
  AlertTriangle,
  MessageSquare,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/common/search-bar";
import { DataTable, type Column } from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { ToneBadge } from "@/components/messages/tone-badge";
import { apiGet, apiPost } from "@/lib/api-client";
import { formatDateTime, truncate, cn } from "@/lib/utils";
import type { MessageDraft, Campaign } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";

const messageStatusVariants: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-yellow-50 text-yellow-700",
  approved: "bg-blue-50 text-blue-700",
  sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  replied: "bg-purple-50 text-purple-700",
  bounced: "bg-orange-50 text-orange-700",
};

type TabStatus =
  | "all"
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "failed";

const TABS: { id: TabStatus; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: Mail },
  { id: "draft", label: "Drafts", icon: Pencil },
  { id: "pending_approval", label: "Pending Approval", icon: Clock },
  { id: "approved", label: "Approved", icon: Check },
  { id: "sent", label: "Sent", icon: Send },
  { id: "failed", label: "Failed", icon: AlertTriangle },
];

const emptyMessages: Record<TabStatus, { title: string; description: string }> =
  {
    all: {
      title: "No messages yet",
      description:
        "Messages will appear here once you generate them from campaigns.",
    },
    draft: {
      title: "No draft messages",
      description: "Draft messages will appear here after AI generation.",
    },
    pending_approval: {
      title: "No messages pending approval",
      description: "Messages submitted for review will appear here.",
    },
    approved: {
      title: "No approved messages",
      description: "Approved messages ready for sending will appear here.",
    },
    sent: {
      title: "No sent messages",
      description: "Sent messages and their tracking data will appear here.",
    },
    failed: {
      title: "No failed messages",
      description: "Messages that failed to send will appear here.",
    },
  };

export default function MessagesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabStatus>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [campaignFilter, setCampaignFilter] = useState("");
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [bulkApproveLoading, setBulkApproveLoading] = useState(false);
  const [bulkSendLoading, setBulkSendLoading] = useState(false);

  // Fetch campaigns for filter
  const { data: campaignsData } = useSWR<PaginatedResponse<Campaign>>(
    "/campaigns?per_page=100",
    (url: string) => apiGet<PaginatedResponse<Campaign>>(url)
  );
  const campaigns = campaignsData?.items ?? [];

  // Fetch status counts
  const { data: countsData } = useSWR<{
    data: Record<string, number>;
  }>("/messages/counts", (url: string) =>
    apiGet<{ data: Record<string, number> }>(url)
  );
  const statusCounts = countsData?.data ?? {};
  const totalCount = Object.values(statusCounts).reduce(
    (sum, c) => sum + c,
    0
  );

  const getTabCount = (tab: TabStatus): number => {
    if (tab === "all") return totalCount;
    return statusCounts[tab] ?? 0;
  };

  // Build query
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", String(perPage));
    if (activeTab !== "all") params.set("status", activeTab);
    if (search) params.set("search", search);
    if (campaignFilter) params.set("campaign_id", campaignFilter);
    return params.toString();
  }, [page, perPage, activeTab, search, campaignFilter]);

  const queryKey = `/messages?${buildQueryString()}`;

  const { data, isLoading } = useSWR<PaginatedResponse<MessageDraft>>(
    queryKey,
    (url: string) => apiGet<PaginatedResponse<MessageDraft>>(url)
  );

  const messages = data?.items ?? [];
  const total = data?.total ?? 0;

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTabChange = (tab: TabStatus) => {
    setActiveTab(tab);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleBulkApprove = async () => {
    setBulkApproveLoading(true);
    try {
      await apiPost("/messages/bulk-approve", {
        ids: Array.from(selectedIds),
      });
      setSelectedIds(new Set());
      mutate(queryKey);
      mutate("/messages/counts");
    } catch {
      // Error handling
    } finally {
      setBulkApproveLoading(false);
    }
  };

  const handleBulkSend = async () => {
    setBulkSendLoading(true);
    try {
      await apiPost("/messages/bulk-send", {
        ids: Array.from(selectedIds),
      });
      setSelectedIds(new Set());
      mutate(queryKey);
      mutate("/messages/counts");
    } catch {
      // Error handling
    } finally {
      setBulkSendLoading(false);
    }
  };

  const columns: Column<MessageDraft>[] = [
    {
      key: "subject",
      label: "Subject",
      render: (item) => (
        <span className="font-semibold text-gray-900">
          {truncate(item.subject, 50)}
        </span>
      ),
    },
    {
      key: "contactName",
      label: "Contact",
      render: (item) => (
        <div>
          <p className="text-sm font-medium text-gray-900">
            {item.contactName ?? "Unknown"}
          </p>
          <p className="text-xs text-gray-500">{item.contactEmail}</p>
        </div>
      ),
    },
    {
      key: "companyName",
      label: "Company",
      render: (item) =>
        item.companyName ? (
          <span className="text-sm text-gray-700">{item.companyName}</span>
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
    {
      key: "campaignName",
      label: "Campaign",
      render: (item) =>
        item.campaignName ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/campaigns/${item.campaignId}`);
            }}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            {item.campaignName}
          </button>
        ) : (
          <span className="text-gray-300">&mdash;</span>
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
    {
      key: "sentAt",
      label: "Sent",
      render: (item) =>
        item.sentAt ? (
          <span className="text-xs text-gray-600">
            {formatDateTime(item.sentAt)}
          </span>
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
    {
      key: "actions",
      label: "",
      className: "w-10",
      render: (item) => (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() =>
              setOpenActionId(openActionId === item.id ? null : item.id)
            }
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {openActionId === item.id && (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  setOpenActionId(null);
                  router.push(`/dashboard/messages/${item.id}`);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye className="h-4 w-4" />
                View
              </button>
              {item.status === "draft" && (
                <button
                  onClick={() => {
                    setOpenActionId(null);
                    router.push(`/dashboard/messages/${item.id}?edit=true`);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}
              {item.status === "pending_approval" && (
                <button
                  onClick={async () => {
                    setOpenActionId(null);
                    try {
                      await apiPost(`/messages/${item.id}/approve`);
                      mutate(queryKey);
                      mutate("/messages/counts");
                    } catch {
                      /* silent */
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-green-700 hover:bg-green-50"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </button>
              )}
              {item.status === "approved" && (
                <button
                  onClick={async () => {
                    setOpenActionId(null);
                    try {
                      await apiPost(`/messages/${item.id}/send`);
                      mutate(queryKey);
                      mutate("/messages/counts");
                    } catch {
                      /* silent */
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              )}
              <button
                onClick={async () => {
                  setOpenActionId(null);
                  try {
                    await apiPost(`/messages/${item.id}/regenerate`);
                    mutate(queryKey);
                  } catch {
                    /* silent */
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-purple-700 hover:bg-purple-50"
              >
                <Sparkles className="h-4 w-4" />
                Regenerate
              </button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
            {totalCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {totalCount}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Manage your outreach messages, approve drafts, and track delivery.
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = getTabCount(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                      activeTab === tab.id
                        ? "bg-primary-100 text-primary-700"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search subject, contact, or company..."
          value={search}
          onChange={handleSearch}
          className="max-w-md flex-1"
        />
        <select
          value={campaignFilter}
          onChange={(e) => {
            setCampaignFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
          <span className="text-sm font-medium text-primary-700">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkApprove}
              isLoading={bulkApproveLoading}
            >
              <Check className="mr-1 h-3.5 w-3.5 text-green-500" />
              Approve All Selected
            </Button>
            <Button
              size="sm"
              onClick={handleBulkSend}
              isLoading={bulkSendLoading}
            >
              <Send className="mr-1 h-3.5 w-3.5" />
              Send All Approved
            </Button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-primary-600 hover:text-primary-800"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && messages.length === 0 && !search && !campaignFilter && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Inbox className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            {emptyMessages[activeTab].title}
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-gray-500">
            {emptyMessages[activeTab].description}
          </p>
        </div>
      )}

      {/* Table */}
      {(isLoading ||
        messages.length > 0 ||
        search ||
        campaignFilter) && (
        <>
          <DataTable
            columns={columns}
            data={messages}
            keyField="id"
            isLoading={isLoading}
            selectable
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
            onRowClick={(item) =>
              router.push(
                `/dashboard/messages/${(item as unknown as MessageDraft).id}`
              )
            }
            emptyMessage={
              search || campaignFilter
                ? "No messages found matching your criteria."
                : emptyMessages[activeTab].description
            }
          />

          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={(pp) => {
              setPerPage(pp);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
