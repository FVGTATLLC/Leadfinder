"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Plus, Download, Trash2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/common/search-bar";
import { CompanyTable } from "@/components/companies/company-table";
import { AddCompanyModal } from "@/components/companies/add-company-modal";
import { Pagination } from "@/components/common/pagination";
import {
  FilterPanel,
  type FilterConfig,
} from "@/components/common/filter-panel";
import { apiGet } from "@/lib/api-client";
import type { Company } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";

interface CompanyRow {
  industry?: string | null;
  geography?: string | null;
  status?: string | null;
}

function buildFilterConfigs(rows: CompanyRow[]): FilterConfig[] {
  const toOptions = (key: keyof CompanyRow) => {
    const seen = new Set<string>();
    for (const row of rows) {
      const v = row[key];
      if (typeof v === "string" && v.trim()) seen.add(v.trim());
    }
    return Array.from(seen)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ label: v, value: v }));
  };

  const statusOptions = [
    { label: "New", value: "new" },
    { label: "In Process", value: "in_process" },
    { label: "Converted to customer", value: "converted" },
  ];

  return [
    { name: "Industry", key: "industry", type: "select", options: toOptions("industry") },
    { name: "Geography", key: "geography", type: "select", options: toOptions("geography") },
    { name: "Status", key: "status", type: "select", options: statusOptions },
  ];
}

interface FilterValues {
  [key: string]: string | string[] | { min: string; max: string };
}

export default function CompaniesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [sortColumn, setSortColumn] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({});
  const [showAddModal, setShowAddModal] = useState(false);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", String(perPage));
    params.set("sort", sortColumn);
    params.set("direction", sortDirection);
    if (search) params.set("search", search);

    // Applied filters
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        params.set(key, value);
      } else if (Array.isArray(value) && value.length > 0) {
        params.set(key, value.join(","));
      } else if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        if (value.min) params.set(`${key}_min`, value.min);
        if (value.max) params.set(`${key}_max`, value.max);
      }
    });

    return params.toString();
  }, [page, perPage, sortColumn, sortDirection, search, appliedFilters]);

  const { data, isLoading, mutate } = useSWR<PaginatedResponse<Company>>(
    `/companies?${buildQueryString()}`,
    (url: string) => apiGet<PaginatedResponse<Company>>(url)
  );

  const companies = data?.items ?? [];
  const total = data?.total ?? 0;

  const filterConfigs = useMemo(
    () => buildFilterConfigs(companies),
    [companies]
  );

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filterValues });
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilterValues({});
    setAppliedFilters({});
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your target company database and ICP scoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              /* TODO: Import CSV modal */
            }}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Company
          </Button>
        </div>
      </div>

      {/* Search */}
      <SearchBar
        placeholder="Search by company name or domain..."
        value={search}
        onChange={handleSearch}
        className="max-w-md"
      />

      {/* Filters */}
      <FilterPanel
        filters={filterConfigs}
        values={filterValues}
        onChange={setFilterValues}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
          <span className="text-sm font-medium text-primary-700">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-1 h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Re-score
            </Button>
            <Button variant="danger" size="sm">
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
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

      {/* Table */}
      <CompanyTable
        companies={companies}
        isLoading={isLoading}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        selectable
        selectedIds={selectedIds}
        onSelectChange={setSelectedIds}
      />

      {/* Pagination */}
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

      {/* Add Company Modal */}
      <AddCompanyModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => mutate()}
      />
    </div>
  );
}
