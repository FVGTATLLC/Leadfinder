"use client";

import {
  Building2,
  Users,
  Activity,
  Database,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportType } from "@/types/models";

interface ExportTypeOption {
  type: ExportType;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

const EXPORT_OPTIONS: ExportTypeOption[] = [
  {
    type: ExportType.COMPANIES,
    label: "Companies",
    description: "Export all companies with ICP scores",
    icon: Building2,
    color: "bg-blue-100 text-blue-600 border-blue-200",
  },
  {
    type: ExportType.CONTACTS,
    label: "Contacts",
    description: "Export contacts with enrichment data",
    icon: Users,
    color: "bg-violet-100 text-violet-600 border-violet-200",
  },
  {
    type: ExportType.ACTIVITIES,
    label: "Activities",
    description: "Export activity logs and audit trail",
    icon: Activity,
    color: "bg-emerald-100 text-emerald-600 border-emerald-200",
  },
  {
    type: ExportType.CRM_FULL,
    label: "Full CRM",
    description: "Combined CRM-ready export",
    icon: Database,
    color: "bg-orange-100 text-orange-600 border-orange-200",
  },
  {
    type: ExportType.CAMPAIGN_REPORT,
    label: "Campaign Report",
    description: "Detailed campaign performance report",
    icon: FileText,
    color: "bg-pink-100 text-pink-600 border-pink-200",
  },
];

interface ExportTypeSelectorProps {
  value: ExportType | null;
  onChange: (type: ExportType) => void;
}

export function ExportTypeSelector({
  value,
  onChange,
}: ExportTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {EXPORT_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.type;
        return (
          <button
            key={option.type}
            type="button"
            onClick={() => onChange(option.type)}
            className={cn(
              "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
              isSelected
                ? "border-primary-500 bg-primary-50/50 ring-1 ring-primary-500"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border",
                option.color
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p
                className={cn(
                  "text-sm font-semibold",
                  isSelected ? "text-primary-700" : "text-gray-900"
                )}
              >
                {option.label}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {option.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
