"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR, { mutate } from "swr";
import {
  Users,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Plus,
  Search,
  Copy,
  Key,
  Activity,
  UserPlus,
  UserCheck,
  UserX,
  Loader2,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/common/pagination";
import type { User } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingApprovals: number;
  onlineNow: number;
  recentRegistrations: number;
}

interface ActiveSession {
  id: string;
  fullName: string;
  email: string;
  role: string;
  lastActiveAt: string | null;
}

interface GlobalActivityItem {
  id: string;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type TabKey = "overview" | "pending" | "users" | "activity";

const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "pending", label: "Pending Approvals", icon: UserCheck },
  { key: "users", label: "All Users", icon: Users },
  { key: "activity", label: "Activity Log", icon: Clock },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const { role, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  if (role !== "admin" && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-12 w-12 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          Access Denied
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Only administrators can access this panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage users, approvals, and monitor activity across the platform.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Admin tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "pending" && <PendingApprovalsTab />}
      {activeTab === "users" && <AllUsersTab />}
      {activeTab === "activity" && <ActivityLogTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Overview
// ---------------------------------------------------------------------------

function OverviewTab() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useSWR<DashboardStats>(
    "/users/admin/dashboard-stats",
    (url: string) => apiGet<{ data: DashboardStats }>(url).then((r) => r.data),
    { refreshInterval: 60000 }
  );

  const { data: pendingData, isLoading: pendingLoading } = useSWR<
    PaginatedResponse<User>
  >("/users?is_active=false&per_page=5&page=1", (url: string) =>
    apiGet<PaginatedResponse<User>>(url)
  );

  const {
    data: sessions,
    isLoading: sessionsLoading,
    mutate: mutateSessions,
  } = useSWR<ActiveSession[]>(
    "/users/admin/active-sessions",
    (url: string) =>
      apiGet<{ data: ActiveSession[] }>(url).then((r) => r.data),
    { refreshInterval: 30000 }
  );

  const pendingUsers = pendingData?.items ?? [];

  const statCards = [
    {
      label: "Total Users",
      value: stats?.totalUsers ?? "--",
      icon: Users,
      color: "blue",
    },
    {
      label: "Active Users",
      value: stats?.activeUsers ?? "--",
      icon: CheckCircle,
      color: "green",
    },
    {
      label: "Pending Approvals",
      value: stats?.pendingApprovals ?? "--",
      icon: UserPlus,
      color: "amber",
    },
    {
      label: "Online Now",
      value: stats?.onlineNow ?? "--",
      icon: Activity,
      color: "purple",
    },
  ];

  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600" },
    green: { bg: "bg-green-50", icon: "text-green-600" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600" },
    purple: { bg: "bg-purple-50", icon: "text-purple-600" },
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const colors = colorMap[card.color];
          return (
            <div
              key={card.label}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="h-10 w-10 rounded-lg bg-gray-100" />
                  <div className="mt-3 h-7 w-16 rounded bg-gray-100" />
                  <div className="mt-1 h-4 w-24 rounded bg-gray-100" />
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.bg}`}
                  >
                    <Icon className={`h-5 w-5 ${colors.icon}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {card.value}
                    </p>
                    <p className="text-xs text-gray-500">{card.label}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Registrations */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-semibold text-gray-900">
              Recent Registrations (Pending)
            </h3>
          </div>
          {stats && stats.recentRegistrations > 0 && (
            <span className="text-xs text-gray-500">
              {stats.recentRegistrations} new in last 7 days
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {pendingLoading ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              No pending registrations.
            </div>
          ) : (
            pendingUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {user.role.replace("_", " ")}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            <h3 className="text-base font-semibold text-gray-900">
              Active Sessions
            </h3>
          </div>
          <button
            onClick={() => mutateSessions()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600">User</th>
                <th className="px-6 py-3 font-medium text-gray-600">Role</th>
                <th className="px-6 py-3 font-medium text-gray-600">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessionsLoading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : !sessions || sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-8 text-center text-sm text-gray-500"
                  >
                    No active sessions.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {s.fullName}
                        </p>
                        <p className="text-xs text-gray-500">{s.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
                        {s.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {s.lastActiveAt
                        ? new Date(s.lastActiveAt).toLocaleString()
                        : "--"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Pending Approvals
// ---------------------------------------------------------------------------

function PendingApprovalsTab() {
  const { toast } = useToast();
  const [credentialModal, setCredentialModal] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const pendingKey = "/users?is_active=false&per_page=50&page=1";
  const { data, isLoading } = useSWR<PaginatedResponse<User>>(
    pendingKey,
    (url: string) => apiGet<PaginatedResponse<User>>(url)
  );

  const pendingUsers = data?.items ?? [];

  const handleApprove = useCallback(
    async (userId: string) => {
      setApprovingId(userId);
      try {
        const response = await apiPost<{
          data: {
            user: { email: string };
            temporaryPassword: string;
          };
        }>(`/users/${userId}/approve`, {});
        const result = response?.data;
        setCredentialModal({
          email: result?.user?.email ?? "",
          password: result?.temporaryPassword ?? "",
        });
        mutate(pendingKey);
        mutate("/users/admin/dashboard-stats");
        toast({ title: "User approved successfully", type: "success" });
      } catch (err: any) {
        toast({
          title: "Failed to approve user",
          description: err?.detail || err?.message || "Unknown error",
          type: "error",
        });
      } finally {
        setApprovingId(null);
      }
    },
    [toast]
  );

  const handleReject = useCallback(
    async (userId: string, userName: string) => {
      if (
        !confirm(
          `Are you sure you want to reject ${userName}? This action cannot be undone.`
        )
      )
        return;
      setRejectingId(userId);
      try {
        await apiPost(`/users/${userId}/reject`, {});
        mutate(pendingKey);
        mutate("/users/admin/dashboard-stats");
        toast({ title: "User rejected", type: "success" });
      } catch (err: any) {
        toast({
          title: "Failed to reject user",
          description: err?.detail || err?.message || "Unknown error",
          type: "error",
        });
      } finally {
        setRejectingId(null);
      }
    },
    [toast]
  );

  const handleCopyCredentials = useCallback(() => {
    if (!credentialModal) return;
    const text = `Email: ${credentialModal.email}\nTemporary Password: ${credentialModal.password}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Credentials copied to clipboard", type: "success" });
  }, [credentialModal, toast]);

  return (
    <div className="space-y-4">
      {/* Credential Modal */}
      <Modal
        isOpen={!!credentialModal}
        onClose={() => setCredentialModal(null)}
        title="User Approved!"
        size="md"
        footer={
          <>
            <button
              onClick={handleCopyCredentials}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Copy className="h-4 w-4" />
              Copy Credentials
            </button>
            <button
              onClick={() => setCredentialModal(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Share these credentials with the user:
          </p>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
            <div>
              <span className="text-xs font-medium text-gray-500">Email</span>
              <p className="text-sm font-mono text-gray-900">
                {credentialModal?.email}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">
                Temporary Password
              </span>
              <p className="text-sm font-mono text-gray-900">
                {credentialModal?.password}
              </p>
            </div>
          </div>
          <p className="text-xs text-amber-600">
            The user will be required to change this password on first login.
          </p>
        </div>
      </Modal>

      {/* Pending Users Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-600">Name</th>
              <th className="px-6 py-3 font-medium text-gray-600">Email</th>
              <th className="px-6 py-3 font-medium text-gray-600">
                Requested Role
              </th>
              <th className="px-6 py-3 font-medium text-gray-600">
                Registration Date
              </th>
              <th className="px-6 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-gray-500"
                >
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : pendingUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-300" />
                  No pending approvals. All caught up!
                </td>
              </tr>
            ) : (
              pendingUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {user.fullName}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{user.email}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
                      {user.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500">
                    {new Date(user.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(user.id)}
                        disabled={approvingId === user.id}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {approvingId === user.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(user.id, user.fullName)}
                        disabled={rejectingId === user.id}
                        className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {rejectingId === user.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: All Users
// ---------------------------------------------------------------------------

function AllUsersTab() {
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [activityUserId, setActivityUserId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const queryParams = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (search) queryParams.set("search", search);
  if (roleFilter) queryParams.set("role", roleFilter);
  if (activeFilter) queryParams.set("is_active", activeFilter);

  const queryKey = `/users?${queryParams.toString()}`;

  const { data, isLoading } = useSWR<PaginatedResponse<User>>(
    queryKey,
    (url: string) => apiGet<PaginatedResponse<User>>(url)
  );

  const users = data?.items ?? [];
  const total = data?.total ?? 0;

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClick = () => setActionMenuId(null);
    if (actionMenuId) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [actionMenuId]);

  const handleToggleActive = useCallback(
    async (userId: string) => {
      setTogglingId(userId);
      try {
        await apiPost(`/users/${userId}/toggle-active`, {});
        mutate(queryKey);
        mutate("/users/admin/dashboard-stats");
        toast({ title: "User status updated", type: "success" });
      } catch (err: any) {
        toast({
          title: "Failed to update user",
          description: err?.detail || err?.message || "Unknown error",
          type: "error",
        });
      } finally {
        setTogglingId(null);
        setActionMenuId(null);
      }
    },
    [queryKey, toast]
  );

  const handleResetPassword = useCallback(
    async (userId: string, userName: string) => {
      if (
        !confirm(
          `Reset password for ${userName}? They will be required to change it on next login.`
        )
      )
        return;
      setResettingId(userId);
      try {
        const response = await apiPost<{
          data: {
            user: { email: string };
            temporaryPassword: string;
          };
        }>(`/users/${userId}/reset-password`, {});
        const result = response?.data;
        setPasswordModal({
          email: result?.user?.email ?? userName,
          password: result?.temporaryPassword ?? "",
        });
        mutate(queryKey);
        toast({ title: "Password reset successfully", type: "success" });
      } catch (err: any) {
        toast({
          title: "Failed to reset password",
          description: err?.detail || err?.message || "Unknown error",
          type: "error",
        });
      } finally {
        setResettingId(null);
        setActionMenuId(null);
      }
    },
    [queryKey, toast]
  );

  const handleCopyPassword = useCallback(() => {
    if (!passwordModal) return;
    const text = `Email: ${passwordModal.email}\nNew Password: ${passwordModal.password}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Credentials copied to clipboard", type: "success" });
  }, [passwordModal, toast]);

  return (
    <div className="space-y-4">
      {/* Password Modal */}
      <Modal
        isOpen={!!passwordModal}
        onClose={() => setPasswordModal(null)}
        title="Password Reset"
        size="md"
        footer={
          <>
            <button
              onClick={handleCopyPassword}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Copy className="h-4 w-4" />
              Copy Credentials
            </button>
            <button
              onClick={() => setPasswordModal(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Share the new credentials with the user:
          </p>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
            <div>
              <span className="text-xs font-medium text-gray-500">Email</span>
              <p className="text-sm font-mono text-gray-900">
                {passwordModal?.email}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">
                New Password
              </span>
              <p className="text-sm font-mono text-gray-900">
                {passwordModal?.password}
              </p>
            </div>
          </div>
          <p className="text-xs text-amber-600">
            The user will be required to change this password on first login.
          </p>
        </div>
      </Modal>

      {/* Activity Modal */}
      <Modal
        isOpen={!!activityUserId}
        onClose={() => setActivityUserId(null)}
        title="User Activity"
        size="lg"
      >
        {activityUserId && (
          <UserActivityPanel userId={activityUserId} />
        )}
      </Modal>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          mutate(queryKey);
          mutate("/users/admin/dashboard-stats");
        }}
      />

      {/* Filters & Create Button */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="sales_rep">Sales Rep</option>
        </select>
        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <div className="ml-auto">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Create User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600">Name</th>
                <th className="px-6 py-3 font-medium text-gray-600">Email</th>
                <th className="px-6 py-3 font-medium text-gray-600">Role</th>
                <th className="px-6 py-3 font-medium text-gray-600">Status</th>
                <th className="px-6 py-3 font-medium text-gray-600">
                  Last Login
                </th>
                <th className="px-6 py-3 font-medium text-gray-600">
                  Last Active
                </th>
                <th className="px-6 py-3 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-sm text-gray-500"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {user.fullName}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{user.email}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          user.role === "admin"
                            ? "bg-purple-50 text-purple-700"
                            : user.role === "manager"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.isActive ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString()
                        : "--"}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {user.lastActiveAt
                        ? new Date(user.lastActiveAt).toLocaleString()
                        : "--"}
                    </td>
                    <td className="px-6 py-3">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuId(
                              actionMenuId === user.id ? null : user.id
                            );
                          }}
                          className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Actions
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        {actionMenuId === user.id && (
                          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetPassword(user.id, user.fullName);
                              }}
                              disabled={
                                resettingId === user.id ||
                                user.role === "admin"
                              }
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Key className="h-4 w-4" />
                              {resettingId === user.id
                                ? "Resetting..."
                                : "Reset Password"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleActive(user.id);
                              }}
                              disabled={
                                togglingId === user.id ||
                                user.role === "admin"
                              }
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {user.isActive ? (
                                <>
                                  <UserX className="h-4 w-4" />
                                  {togglingId === user.id
                                    ? "Updating..."
                                    : "Deactivate"}
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4" />
                                  {togglingId === user.id
                                    ? "Updating..."
                                    : "Activate"}
                                </>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivityUserId(user.id);
                                setActionMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="h-4 w-4" />
                              View Activity
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={setPage}
        onPerPageChange={() => {}}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Activity Log
// ---------------------------------------------------------------------------

function ActivityLogTab() {
  const [page, setPage] = useState(1);
  const perPage = 30;

  const { data, isLoading } = useSWR(
    `/users/admin/global-activity?page=${page}&per_page=${perPage}`,
    (url: string) =>
      apiGet<{ items: GlobalActivityItem[]; total: number }>(url)
  );

  const activities = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600">User</th>
                <th className="px-6 py-3 font-medium text-gray-600">Action</th>
                <th className="px-6 py-3 font-medium text-gray-600">Entity</th>
                <th className="px-6 py-3 font-medium text-gray-600">
                  IP Address
                </th>
                <th className="px-6 py-3 font-medium text-gray-600">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-gray-500"
                  >
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                activities.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {log.userName || "--"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {log.userEmail || "--"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {log.entityType || "--"}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {log.ipAddress || "--"}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={setPage}
        onPerPageChange={() => {}}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create User Modal
// ---------------------------------------------------------------------------

function CreateUserModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("Welcome@123");
  const [role, setRole] = useState("sales_rep");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setFullName("");
      setPassword("Welcome@123");
      setRole("sales_rep");
      setError("");
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await apiPost("/users", {
        email,
        full_name: fullName,
        password,
        role,
      });
      toast({ title: "User created successfully", type: "success" });
      onCreated();
    } catch (err: any) {
      setError(err?.detail || err?.message || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New User"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={isSubmitting || !email || !fullName}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create User
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Full Name *
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="e.g. John Doe"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Email *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="e.g. john@company.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Password *
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
          <p className="mt-1 text-xs text-gray-500">
            Default: Welcome@123
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Role *
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="sales_rep">Sales Rep</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// User Activity Panel (used inside modal)
// ---------------------------------------------------------------------------

function UserActivityPanel({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useSWR(
    `/users/${userId}/activity?page=${page}&per_page=20`,
    (url: string) => apiGet<any>(url)
  );

  const activities = data?.items ?? [];
  const total = data?.total ?? 0;
  const userInfo = data?.user;

  return (
    <div className="space-y-4">
      {userInfo && (
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {userInfo.full_name || userInfo.fullName}
            </p>
            <p className="text-xs text-gray-500">{userInfo.email}</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 font-medium text-gray-600">Action</th>
              <th className="px-4 py-2.5 font-medium text-gray-600">Entity</th>
              <th className="px-4 py-2.5 font-medium text-gray-600">
                IP Address
              </th>
              <th className="px-4 py-2.5 font-medium text-gray-600">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  No activity recorded yet.
                </td>
              </tr>
            ) : (
              activities.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-900">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {log.entityType || log.entity_type || "--"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {log.ipAddress || log.ip_address || "--"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {new Date(
                      log.createdAt || log.created_at
                    ).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <Pagination
          page={page}
          perPage={20}
          total={total}
          onPageChange={setPage}
          onPerPageChange={() => {}}
        />
      )}
    </div>
  );
}
