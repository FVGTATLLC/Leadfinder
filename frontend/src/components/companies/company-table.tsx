"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { DataTable, type Column } from "@/components/common/data-table";
import { apiPatch } from "@/lib/api-client";
import {
  CompanyStatus,
  COMPANY_STATUS_LABEL,
  type Company,
} from "@/types/models";

const STATUS_STYLE: Record<CompanyStatus, string> = {
  [CompanyStatus.NEW]: "bg-blue-50 text-blue-700 border-blue-200",
  [CompanyStatus.IN_PROCESS]: "bg-amber-50 text-amber-700 border-amber-200",
  [CompanyStatus.CONVERTED]: "bg-green-50 text-green-700 border-green-200",
  [CompanyStatus.LOST]: "bg-red-50 text-red-700 border-red-200",
};

interface InlineStatusSelectProps {
  companyId: string;
  value: CompanyStatus;
  onChanged?: (next: CompanyStatus) => void;
}

function InlineStatusSelect({
  companyId,
  value,
  onChanged,
}: InlineStatusSelectProps) {
  const [current, setCurrent] = useState<CompanyStatus>(value);
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: CompanyStatus) => {
    if (next === current) return;
    const previous = current;
    setCurrent(next);
    setSaving(true);
    try {
      await apiPatch(`/companies/${companyId}`, { status: next });
      onChanged?.(next);
    } catch {
      setCurrent(previous);
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      value={current}
      disabled={saving}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => handleChange(e.target.value as CompanyStatus)}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${STATUS_STYLE[current]} disabled:opacity-60`}
    >
      {Object.values(CompanyStatus).map((s) => (
        <option key={s} value={s}>
          {COMPANY_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

interface CompanyTableProps {
  companies: Company[];
  isLoading?: boolean;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectChange?: (ids: Set<string>) => void;
  onStatusChanged?: (companyId: string, status: CompanyStatus) => void;
}

export function CompanyTable({
  companies,
  isLoading = false,
  sortColumn,
  sortDirection,
  onSort,
  selectable = false,
  selectedIds,
  onSelectChange,
  onStatusChanged,
}: CompanyTableProps) {
  const router = useRouter();

  const columns: Column<Company>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
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
      key: "phone",
      label: "Phone Number",
      render: (item) => {
        const phone = (item.scoreBreakdown?.phone as string | undefined) ?? null;
        return phone ? (
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-gray-700 hover:text-primary-600"
          >
            {phone}
          </a>
        ) : (
          <span className="text-gray-300">&mdash;</span>
        );
      },
    },
    {
      key: "website",
      label: "Website",
      render: (item) =>
        item.website ? (
          <a
            href={item.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
          >
            {item.domain && !item.domain.startsWith("gmaps-")
              ? item.domain
              : item.website}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
    {
      key: "reviewsCount",
      label: "Reviews Count",
      render: (item) => {
        const count = item.scoreBreakdown?.reviews_count ?? item.scoreBreakdown?.reviewsCount;
        const rating = item.scoreBreakdown?.total_score ?? item.scoreBreakdown?.totalScore;
        if (typeof count !== "number") {
          return <span className="text-gray-300">&mdash;</span>;
        }
        return (
          <span className="text-sm text-gray-700">
            {count.toLocaleString()}
            {typeof rating === "number" && (
              <span className="ml-1 text-xs text-gray-500">
                (★{rating.toFixed(1)})
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <InlineStatusSelect
          companyId={item.id}
          value={(item.status as CompanyStatus) ?? CompanyStatus.NEW}
          onChanged={(next) => onStatusChanged?.(item.id, next)}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={companies}
      keyField="id"
      isLoading={isLoading}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      onSort={onSort}
      selectable={selectable}
      selectedIds={selectedIds}
      onSelectChange={onSelectChange}
      onRowClick={(item) =>
        router.push(`/dashboard/companies/${(item as unknown as Company).id}`)
      }
      emptyMessage="No companies found matching your criteria."
    />
  );
}
