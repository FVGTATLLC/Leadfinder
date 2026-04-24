"use client";

import { useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Modal } from "@/components/ui/modal";
import { SearchBar } from "@/components/common/search-bar";
import type { Company } from "@/types/models";

interface StrategyCompanyListProps {
  companies: Company[];
  isLoading?: boolean;
  onRemove?: (companyId: string) => void;
  onAddCompanies?: () => void;
  onCompanyClick?: (company: Company) => void;
}

export function StrategyCompanyList({
  companies,
  isLoading = false,
  onRemove,
  onAddCompanies,
  onCompanyClick,
}: StrategyCompanyListProps) {
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
              : new URL(item.website).hostname}
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
    ...(onRemove
      ? [
          {
            key: "actions" as const,
            label: "",
            className: "w-10",
            render: (item: Company) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Remove from strategy"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Companies ({companies.length})
        </h3>
        {onAddCompanies && (
          <Button variant="outline" size="sm" onClick={onAddCompanies}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Companies
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={companies}
        keyField="id"
        isLoading={isLoading}
        onRowClick={
          onCompanyClick
            ? (item) => onCompanyClick(item as unknown as Company)
            : undefined
        }
        emptyMessage="No companies in this strategy yet. Add companies or run the Discovery Agent."
      />
    </div>
  );
}
