"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/common/data-table";
import { ScoreBadge } from "@/components/companies/score-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { Modal } from "@/components/ui/modal";
import { SearchBar } from "@/components/common/search-bar";
import { formatNumber } from "@/lib/utils";
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
      label: "Company",
      render: (item) => (
        <div>
          <p className="font-medium text-gray-900">{item.name}</p>
          {item.domain && (
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
      key: "employeeCount",
      label: "Employees",
      render: (item) =>
        item.employeeCount !== null ? (
          <span className="text-sm text-gray-700">
            {formatNumber(item.employeeCount)}
          </span>
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
    {
      key: "icpScore",
      label: "ICP Score",
      render: (item) => <ScoreBadge score={item.icpScore} />,
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
