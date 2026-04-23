"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Users, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/common/search-bar";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { apiGet } from "@/lib/api-client";
import type { Contact } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";

const personaBadgeVariants: Record<string, string> = {
  procurement_head: "bg-indigo-50 text-indigo-700",
  admin: "bg-gray-100 text-gray-700",
  cfo: "bg-emerald-50 text-emerald-700",
  travel_manager: "bg-sky-50 text-sky-700",
  ceo: "bg-amber-50 text-amber-700",
  hr_head: "bg-pink-50 text-pink-700",
  other: "bg-slate-100 text-slate-600",
};

interface ContactSelectorProps {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  strategyId?: string | null;
}

export function ContactSelector({
  selectedIds,
  onChange,
  strategyId,
}: ContactSelectorProps) {
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [personaFilter, setPersonaFilter] = useState("");
  const [strategyLoading, setStrategyLoading] = useState(false);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", "50");
    if (search) params.set("search", search);
    if (companyFilter) params.set("company_id", companyFilter);
    if (personaFilter) params.set("persona_type", personaFilter);
    return params.toString();
  }, [search, companyFilter, personaFilter]);

  const { data, isLoading } = useSWR<PaginatedResponse<Contact>>(
    `/contacts?${buildQueryString()}`,
    (url: string) => apiGet<PaginatedResponse<Contact>>(url)
  );

  const contacts = data?.items ?? [];

  const handleLoadFromStrategy = async () => {
    if (!strategyId) return;
    setStrategyLoading(true);
    try {
      const strategyContacts = await apiGet<PaginatedResponse<Contact>>(
        `/contacts?strategy_id=${strategyId}&per_page=200`
      );
      const newIds = new Set(selectedIds);
      strategyContacts.items.forEach((c) => newIds.add(c.id));
      onChange(newIds);
    } catch {
      // Silent fail
    } finally {
      setStrategyLoading(false);
    }
  };

  const handleSelectAll = () => {
    const newIds = new Set(selectedIds);
    contacts.forEach((c) => newIds.add(c.id));
    onChange(newIds);
  };

  const handleClearAll = () => {
    onChange(new Set());
  };

  const columns: Column<Contact>[] = [
    {
      key: "name",
      label: "Name",
      render: (item) => (
        <div>
          <p className="font-medium text-gray-900">
            {item.firstName} {item.lastName}
          </p>
          {item.jobTitle && (
            <p className="text-xs text-gray-500">{item.jobTitle}</p>
          )}
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (item) => (
        <span className="text-sm text-gray-700">{item.email}</span>
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
      key: "personaType",
      label: "Persona",
      render: (item) => (
        <StatusBadge status={item.personaType} variantMap={personaBadgeVariants} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search contacts..."
          value={search}
          onChange={setSearch}
          className="flex-1"
        />
        <select
          value={personaFilter}
          onChange={(e) => setPersonaFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">All Personas</option>
          <option value="procurement_head">Procurement Head</option>
          <option value="admin">Admin</option>
          <option value="cfo">CFO</option>
          <option value="travel_manager">Travel Manager</option>
          <option value="ceo">CEO</option>
          <option value="hr_head">HR Head</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
        <span className="text-sm font-medium text-gray-700">
          {selectedIds.size} contact{selectedIds.size !== 1 ? "s" : ""} selected
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            Clear All
          </Button>
          {strategyId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadFromStrategy}
              isLoading={strategyLoading}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Load from Strategy
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={contacts}
        keyField="id"
        isLoading={isLoading}
        selectable
        selectedIds={selectedIds}
        onSelectChange={onChange}
        emptyMessage="No contacts found."
      />
    </div>
  );
}
