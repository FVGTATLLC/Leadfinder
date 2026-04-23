"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Sparkles,
  Star,
  Copy,
  ExternalLink,
  Linkedin,
  Phone,
  Mail,
  Briefcase,
  Building2,
  MapPin,
  MoreVertical,
  CheckCircle2,
  RefreshCw,
  Megaphone,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EnrichmentStatusBadge } from "@/components/contacts/enrichment-status-badge";
import { ConfidenceIndicator } from "@/components/contacts/confidence-indicator";
import { ContactForm, type ContactFormData } from "@/components/contacts/contact-form";
import { StatusBadge } from "@/components/common/status-badge";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { formatDate, formatDateTime, cn, normaliseLinkedInUrl } from "@/lib/utils";
import type { Contact, Company } from "@/types/models";
import type { ApiResponse } from "@/types/api";

const personaBadgeVariants: Record<string, string> = {
  procurement_head: "bg-indigo-50 text-indigo-700",
  admin: "bg-gray-100 text-gray-700",
  cfo: "bg-emerald-50 text-emerald-700",
  travel_manager: "bg-sky-50 text-sky-700",
  ceo: "bg-amber-50 text-amber-700",
  hr_head: "bg-pink-50 text-pink-700",
  other: "bg-slate-100 text-slate-600",
};

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className="mt-0.5 text-sm text-gray-900">{children}</div>
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useSWR<ApiResponse<Contact>>(
    `/contacts/${contactId}`,
    (url: string) => apiGet<ApiResponse<Contact>>(url)
  );

  const contact = data?.data;

  // Fetch company details if companyId exists
  const { data: companyData } = useSWR<ApiResponse<Company>>(
    contact?.companyId ? `/companies/${contact.companyId}` : null,
    (url: string) => apiGet<ApiResponse<Company>>(url)
  );
  const company = companyData?.data;

  const handleCopyEmail = () => {
    if (contact?.email) {
      navigator.clipboard.writeText(contact.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnrich = async () => {
    setEnrichLoading(true);
    setError(null);
    try {
      await apiPost(`/contacts/${contactId}/enrich`);
      mutate(`/contacts/${contactId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to enrich contact"
      );
    } finally {
      setEnrichLoading(false);
    }
  };

  const handleVerifyApollo = async () => {
    setVerifyLoading(true);
    setError(null);
    try {
      const response = await apiPost<any>(`/contacts/${contactId}/verify-apollo`);
      // The middleware wraps the response in { data: {...} }
      const result = response?.data ?? response;
      const verified = result?.verified;
      const apolloData = result?.apolloData ?? result?.apollo_data;
      const message = result?.message;

      if (verified) {
        setIsVerified(true);
        mutate(`/contacts/${contactId}`);
        alert(
          `✅ Contact verified via Apollo!\n\n` +
          `Email: ${apolloData?.email ?? contact?.email ?? "(unchanged)"}\n` +
          (apolloData?.title ? `Title: ${apolloData.title}\n` : "") +
          (apolloData?.linkedin ? `LinkedIn: ${apolloData.linkedin}\n` : "") +
          (apolloData?.phone ? `Phone: ${apolloData.phone}` : "")
        );
      } else {
        alert(message ?? "Contact not found in Apollo database");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to verify contact with Apollo"
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSetPrimary = async () => {
    try {
      await apiPatch(`/contacts/${contactId}`, { isPrimary: true });
      mutate(`/contacts/${contactId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set as primary"
      );
    }
  };

  const handleSaveNotes = async () => {
    if (notes === null) return;
    setNotesLoading(true);
    try {
      await apiPatch(`/contacts/${contactId}`, { notes });
      mutate(`/contacts/${contactId}`);
    } catch {
      // Silent fail
    } finally {
      setNotesLoading(false);
    }
  };

  const handleEdit = async (formData: ContactFormData) => {
    setEditLoading(true);
    try {
      await apiPatch(`/contacts/${contactId}`, formData);
      setIsEditOpen(false);
      mutate(`/contacts/${contactId}`);
    } catch {
      // Error handled by form
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await apiDelete(`/contacts/${contactId}`);
      router.push("/dashboard/contacts");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete contact"
      );
      setDeleteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-gray-200" />
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="flex gap-6">
            <div className="h-64 flex-[2] rounded-xl bg-gray-100" />
            <div className="h-64 flex-1 rounded-xl bg-gray-100" />
          </div>
          <div className="h-40 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-lg font-semibold text-gray-900">
          Contact not found
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          The contact you are looking for does not exist or was deleted.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard/contacts")}
        >
          Back to Contacts
        </Button>
      </div>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const currentNotes = notes ?? contact.notes ?? "";

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/contacts")}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Contacts
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
              {contact.isPrimary && (
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              )}
              <StatusBadge
                status={contact.personaType}
                variantMap={personaBadgeVariants}
              />
              <EnrichmentStatusBadge status={contact.enrichmentStatus} />
            </div>
            {contact.jobTitle && (
              <p className="mt-1 text-sm text-gray-500">{contact.jobTitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isVerified || contact.enrichmentStatus === "verified" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyApollo}
                isLoading={verifyLoading}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                Verify with Apollo
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnrich}
              isLoading={enrichLoading}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Enrich
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetPrimary}
              disabled={contact.isPrimary}
            >
              <Star className="mr-1.5 h-3.5 w-3.5" />
              {contact.isPrimary ? "Primary" : "Set as Primary"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
            >
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActions(!showActions)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              {showActions && (
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      setShowActions(false);
                      setIsDeleteOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Contact
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Contact Info Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Contact Information
            </h2>
            <div className="divide-y divide-gray-100">
              <InfoRow icon={Mail} label="Email">
                <div className="flex items-center gap-2">
                  <span>{contact.email}</span>
                  {contact.emailVerified && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  )}
                  <button
                    onClick={handleCopyEmail}
                    className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="Copy email"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  {copied && (
                    <span className="text-xs text-green-600">Copied!</span>
                  )}
                </div>
              </InfoRow>
              <InfoRow icon={Phone} label="Phone">
                {contact.phone ?? (
                  <span className="text-gray-300">&mdash;</span>
                )}
              </InfoRow>
              <InfoRow icon={Briefcase} label="Job Title">
                {contact.jobTitle ?? (
                  <span className="text-gray-300">&mdash;</span>
                )}
              </InfoRow>
              <InfoRow icon={Linkedin} label="LinkedIn">
                {contact.linkedinUrl ? (
                  <a
                    href={normaliseLinkedInUrl(contact.linkedinUrl) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
                  >
                    View Profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(
                      `site:linkedin.com/in "${contact.firstName} ${contact.lastName}" "${contact.companyName || ""}"`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    title="Search LinkedIn via Google"
                  >
                    Find on LinkedIn
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </InfoRow>
              <InfoRow icon={Briefcase} label="Source">
                {contact.source}
              </InfoRow>
            </div>
          </div>

          {/* Company Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Company
            </h2>
            {company ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <button
                    onClick={() =>
                      router.push(`/dashboard/companies/${company.id}`)
                    }
                    className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    {company.name}
                  </button>
                </div>
                {company.industry && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Briefcase className="h-4 w-4 text-gray-400" />
                    {company.industry}
                  </div>
                )}
                {company.geography && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {company.geography}
                  </div>
                )}
              </div>
            ) : contact.companyName ? (
              <p className="text-sm text-gray-700">{contact.companyName}</p>
            ) : (
              <p className="text-sm text-gray-400">No company associated</p>
            )}
          </div>

          {/* Notes Section */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Notes
              </h2>
              {notes !== null && notes !== (contact.notes ?? "") && (
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  isLoading={notesLoading}
                >
                  Save Notes
                </Button>
              )}
            </div>
            <textarea
              value={currentNotes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this contact..."
              rows={4}
              className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">
          {/* Confidence Score Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Confidence Score
            </h2>
            <div className="flex justify-center">
              <ConfidenceIndicator
                score={contact.confidenceScore}
                size="lg"
                label="Match confidence"
              />
            </div>
          </div>

          {/* Enrichment Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Enrichment
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Status
                </span>
                <EnrichmentStatusBadge
                  status={contact.enrichmentStatus}
                  size="sm"
                />
              </div>
              {contact.enrichmentSource && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Source
                  </span>
                  <span className="text-sm text-gray-700">
                    {contact.enrichmentSource}
                  </span>
                </div>
              )}
              {contact.enrichedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Enriched
                  </span>
                  <span className="text-sm text-gray-700">
                    {formatDate(contact.enrichedAt)}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={handleEnrich}
                isLoading={enrichLoading}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Re-enrich
              </Button>
              {isVerified || contact.enrichmentStatus === "verified" ? (
                <div className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified via Apollo
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={handleVerifyApollo}
                  isLoading={verifyLoading}
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  Verify with Apollo
                </Button>
              )}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" disabled>
                <Megaphone className="mr-1.5 h-3.5 w-3.5" />
                Add to Campaign
              </Button>
              <Button variant="outline" size="sm" className="w-full" disabled>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Generate Research
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Activity Log
        </h2>
        <div className="space-y-3">
          {contact.enrichedAt && (
            <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                <div className="h-2 w-2 rounded-full bg-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Contact enriched
                </p>
                <p className="text-xs text-gray-500">
                  Enriched via {contact.enrichmentSource ?? "system"}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {formatDate(contact.enrichedAt)}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
              <div className="h-2 w-2 rounded-full bg-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Contact added
              </p>
              <p className="text-xs text-gray-500">
                Added via {contact.source}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {formatDate(contact.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Contact"
        size="lg"
      >
        <ContactForm
          initialData={contact}
          companyId={contact.companyId ?? undefined}
          onSubmit={handleEdit}
          isLoading={editLoading}
        />
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Contact"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={deleteLoading}
            >
              Delete Contact
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete &ldquo;{fullName}&rdquo;? This will
          remove the contact and all associated data permanently.
        </p>
      </Modal>
    </div>
  );
}
