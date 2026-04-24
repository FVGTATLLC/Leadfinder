"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/common/search-bar";
import { DataTable, type Column } from "@/components/common/data-table";
import { apiGet } from "@/lib/api-client";
import type { Company } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";

interface CompanySelectorProps {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

export function CompanySelector({
  selectedIds,
  onChange,
}: CompanySelectorProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", "50");
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [search, statusFilter]);

  const { data, isLoading } = useSWR<PaginatedResponse<Company>>(
    `/companies?${buildQueryString()}`,
    (url: string) => apiGet<PaginatedResponse<Company>>(url)
  );

  const companies = data?.items ?? [];

  const handleSelectAll = () => {
    const next = new Set(selectedIds);
    companies.forEach((c) => next.add(c.id));
    onChange(next);
  };

  const handleClearAll = () => onChange(new Set());

  const columns: Column<Company>[] = [
    {
      key: "name",
      label: "Name",
      render: (item) => (
        <div>
          <p className="font-medium text-gray-900">{item.name}</p>
          {item.domain && !item.domain.startsWith("gmaps-") && (
            <p className="text-xs text-gray-500">{item.domain}</p>
          )}
        </div>
      ),
    },
    {
      key: "industry",
      label: "Industry",
      render: (item) =>
        item.industry ? (
          <span className="text-sm text-gray-700">{item.industry}</span>
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
    {
      key: "geography",
      label: "Geography",
      render: (item) =>
        item.geography ? (
          <span className="text-sm text-gray-700">{item.geography}</span>
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <span className="text-xs text-gray-600 capitalize">
          {(item.status ?? "new").replace(/_/g, " ")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search companies..."
          value={search}
          onChange={setSearch}
          className="flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="in_process">In Process</option>
          <option value="converted">Converted to customer</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
        <span className="text-sm font-medium text-gray-700">
          {selectedIds.size} company{selectedIds.size !== 1 ? "s" : ""} selected
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            Clear All
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={companies}
        keyField="id"
        isLoading={isLoading}
        selectable
        selectedIds={selectedIds}
        onSelectChange={onChange}
        emptyMessage="No companies found."
      />
    </div>
  );
}
