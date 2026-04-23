import { Star, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { truncate } from "@/lib/utils";
import { EnrichmentStatusBadge } from "@/components/contacts/enrichment-status-badge";
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

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

interface ContactCardProps {
  contact: Contact;
  onClick?: (contact: Contact) => void;
  className?: string;
}

export function ContactCard({ contact, onClick, className }: ContactCardProps) {
  const bg = personaColors[contact.personaType] ?? personaColors.other;
  const pct =
    contact.confidenceScore !== null
      ? Math.round(contact.confidenceScore * 100)
      : null;
  const barColor =
    pct !== null
      ? pct > 70
        ? "bg-green-500"
        : pct >= 40
          ? "bg-yellow-500"
          : "bg-red-500"
      : "bg-gray-200";

  return (
    <div
      onClick={() => onClick?.(contact)}
      className={cn(
        "group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
    >
      {contact.isPrimary && (
        <div className="absolute right-3 top-3">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
            bg
          )}
        >
          {getInitials(contact.firstName, contact.lastName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">
            {contact.firstName} {contact.lastName}
          </p>
          {contact.jobTitle && (
            <p className="text-xs text-gray-500">{contact.jobTitle}</p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">
            {truncate(contact.email, 30)}
          </span>
          {contact.emailVerified && (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          )}
        </div>

        {contact.companyName && (
          <p className="text-xs font-medium text-gray-600">
            {contact.companyName}
          </p>
        )}
      </div>

      {/* Confidence Score */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-medium text-gray-500">
            Confidence
          </span>
          <span className="text-[10px] font-medium text-gray-600">
            {pct !== null ? `${pct}%` : "\u2014"}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100">
          <div
            className={cn("h-1.5 rounded-full transition-all", barColor)}
            style={{ width: pct !== null ? `${pct}%` : "0%" }}
          />
        </div>
      </div>

      <div className="mt-3">
        <EnrichmentStatusBadge status={contact.enrichmentStatus} size="sm" />
      </div>
    </div>
  );
}
