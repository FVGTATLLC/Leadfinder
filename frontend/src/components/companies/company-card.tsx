import { ExternalLink } from "lucide-react";
import { ScoreBadge } from "@/components/companies/score-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { formatCompactNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Company } from "@/types/models";

interface CompanyCardProps {
  company: Company;
  onClick?: () => void;
  className?: string;
}

export function CompanyCard({ company, onClick, className }: CompanyCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {company.name}
          </h3>
          {company.domain && (
            <a
              href={`https://${company.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
            >
              {company.domain}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <ScoreBadge score={company.icpScore} size="md" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {company.industry && (
          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {company.industry}
          </span>
        )}
        {company.geography && (
          <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            {company.geography}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {company.employeeCount !== null
            ? `${formatCompactNumber(company.employeeCount)} employees`
            : "Size unknown"}
        </span>
        <StatusBadge
          status={company.source}
          variantMap={{
            manual: "bg-gray-100 text-gray-600",
            discovery_agent: "bg-purple-50 text-purple-600",
            import: "bg-blue-50 text-blue-600",
          }}
        />
      </div>
    </div>
  );
}
