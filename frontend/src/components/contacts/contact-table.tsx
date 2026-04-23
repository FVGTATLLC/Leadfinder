"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Eye,
  Sparkles,
  Pencil,
  Trash2,
  CheckCircle2,
  Linkedin,
  ShieldCheck,
} from "lucide-react";
import { DataTable, type Column } from "@/components/common/data-table";
import { EnrichmentStatusBadge } from "@/components/contacts/enrichment-status-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate, normaliseLinkedInUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Contact, PersonaType } from "@/types/models";

const personaColors: Record<string, string> = {
  procurement_head: "bg-indigo-500",
  admin: "bg-gray-500",
  cfo: "bg-emerald-500",
  travel_manager: "bg-sky-500",
  ceo: "bg-amber-500",
  hr_head: "bg-pink-500",
  other: "bg-slate-400",
};

const personaBadgeVariants: Record<string, string> = {
  procurement_head: "bg-indigo-50 text-indigo-700",
  admin: "bg-gray-100 text-gray-700",
  cfo: "bg-emerald-50 text-emerald-700",
  travel_manager: "bg-sky-50 text-sky-700",
  ceo: "bg-amber-50 text-amber-700",
  hr_head: "bg-pink-50 text-pink-700",
  other: "bg-slate-100 text-slate-600",
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function AvatarCircle({
  firstName,
  lastName,
  personaType,
}: {
  firstName: string;
  lastName: string;
  personaType: PersonaType;
}) {
  const bg = personaColors[personaType] ?? personaColors.other;
  return (
    <div
      className={cn(
        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        bg
      )}
    >
      {getInitials(firstName, lastName)}
    </div>
  );
}

interface ContactTableProps {
  contacts: Contact[];
  isLoading?: boolean;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectChange?: (ids: Set<string>) => void;
  onEnrich?: (contact: Contact) => void;
  onVerify?: (contact: Contact) => void;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
}

export function ContactTable({
  contacts,
  isLoading = false,
  sortColumn,
  sortDirection,
  onSort,
  selectable = false,
  selectedIds,
  onSelectChange,
  onEnrich,
  onVerify,
  onEdit,
  onDelete,
}: ContactTableProps) {
  const router = useRouter();
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const columns: Column<Contact>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <AvatarCircle
            firstName={item.firstName}
            lastName={item.lastName}
            personaType={item.personaType}
          />
          <div>
            <p className="font-medium text-gray-900">
              {item.firstName} {item.lastName}
            </p>
            {item.jobTitle && (
              <p className="text-xs text-gray-500">{item.jobTitle}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-700">{item.email}</span>
          {item.emailVerified && (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          )}
        </div>
      ),
    },
    {
      key: "jobTitle",
      label: "Job Title",
      render: (item) =>
        item.jobTitle ? (
          <span className="text-sm text-gray-700">{item.jobTitle}</span>
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
    {
      key: "personaType",
      label: "Persona",
      render: (item) => (
        <StatusBadge
          status={item.personaType}
          variantMap={personaBadgeVariants}
        />
      ),
    },
    {
      key: "companyName",
      label: "Company",
      render: (item) =>
        item.companyName ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (item.companyId) {
                router.push(`/dashboard/companies/${item.companyId}`);
              }
            }}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            {item.companyName}
          </button>
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
    {
      key: "confidenceScore",
      label: "Confidence",
      sortable: true,
      render: (item) => {
        if (item.confidenceScore === null) {
          return <span className="text-gray-300">&mdash;</span>;
        }
        const pct = Math.round(item.confidenceScore * 100);
        const color =
          pct > 70
            ? "bg-green-500"
            : pct >= 40
              ? "bg-yellow-500"
              : "bg-red-500";
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full bg-gray-100">
              <div
                className={cn("h-1.5 rounded-full", color)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600">{pct}%</span>
          </div>
        );
      },
    },
    {
      key: "enrichmentStatus",
      label: "Enrichment",
      sortable: true,
      render: (item) => (
        <EnrichmentStatusBadge status={item.enrichmentStatus} size="sm" />
      ),
    },
    {
      key: "linkedinUrl",
      label: "LinkedIn",
      className: "w-20",
      render: (item) =>
        item.linkedinUrl ? (
          <a
            href={normaliseLinkedInUrl(item.linkedinUrl) ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-[#0A66C2] hover:bg-[#0A66C2]/10"
            title="Open LinkedIn profile (verified)"
          >
            <Linkedin className="h-4 w-4" />
          </a>
        ) : (
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(
              `site:linkedin.com/in "${item.firstName} ${item.lastName}" "${item.companyName || ""}"`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
            title="Find on LinkedIn via Google"
          >
            <Linkedin className="h-4 w-4" />
          </a>
        ),
    },
    {
      key: "actions",
      label: "",
      className: "w-10",
      render: (item) => (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() =>
              setOpenActionId(openActionId === item.id ? null : item.id)
            }
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {openActionId === item.id && (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  setOpenActionId(null);
                  router.push(`/dashboard/contacts/${item.id}`);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye className="h-4 w-4" />
                View
              </button>
              <button
                onClick={() => {
                  setOpenActionId(null);
                  onEnrich?.(item);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Sparkles className="h-4 w-4" />
                Enrich
              </button>
              <button
                onClick={() => {
                  setOpenActionId(null);
                  onVerify?.(item);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
              >
                <ShieldCheck className="h-4 w-4" />
                Verify Email
              </button>
              <button
                onClick={() => {
                  setOpenActionId(null);
                  onEdit?.(item);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => {
                  setOpenActionId(null);
                  onDelete?.(item);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={contacts}
      keyField="id"
      isLoading={isLoading}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      onSort={onSort}
      selectable={selectable}
      selectedIds={selectedIds}
      onSelectChange={onSelectChange}
      onRowClick={(item) =>
        router.push(`/dashboard/contacts/${(item as unknown as Contact).id}`)
      }
      emptyMessage="No contacts found matching your criteria."
    />
  );
}

export { personaColors, personaBadgeVariants };
