"use client";

import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate } from "@/lib/utils";
import type { Company } from "@/types/models";

interface CompanyTableProps {
  companies: Company[];
  isLoading?: boolean;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectChange?: (ids: Set<string>) => void;
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
      key: "source",
      label: "Source",
      render: (item) => (
        <StatusBadge
          status={item.source}
          variantMap={{
            manual: "bg-gray-100 text-gray-700",
            discovery_agent: "bg-purple-50 text-purple-700",
            import: "bg-blue-50 text-blue-700",
          }}
        />
      ),
    },
    {
      key: "created_at",
      label: "Added",
      sortable: true,
      render: (item) => (
        <span className="text-sm text-gray-500">
          {formatDate(item.createdAt)}
        </span>
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
