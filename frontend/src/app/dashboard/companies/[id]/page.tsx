"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  ArrowLeft,
  ExternalLink,
  Edit,
  Trash2,
  RefreshCw,
  Target,
  Users,
  FileText,
  Linkedin,
  Globe,
  MoreVertical,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ScoreBadge } from "@/components/companies/score-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { formatDate, formatNumber, formatCompactNumber, normaliseLinkedInUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Company } from "@/types/models";
import type { ApiResponse } from "@/types/api";

function ScoreBar({
  label,
  value,
  maxValue = 100,
}: {
  label: string;
  value: number;
  maxValue?: number;
}) {
  const pct = Math.min((value / maxValue) * 100, 100);
  const color =
    pct >= 70
      ? "bg-green-500"
      : pct >= 40
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-600">{label}</span>
        <span className="text-gray-500">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className={cn("h-2 rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  span,
}: {
  label: string;
  value: React.ReactNode;
  span?: 2 | 3;
}) {
  const spanClass = span === 3 ? "sm:col-span-2 lg:col-span-3" : span === 2 ? "sm:col-span-2" : "";
  return (
    <div className={spanClass}>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">
        {value ?? <span className="text-gray-300">&mdash;</span>}
      </dd>
    </div>
  );
}

export default function CompanyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI feature states
  const [discoveringContacts, setDiscoveringContacts] = useState(false);
  const [discoveredContacts, setDiscoveredContacts] = useState<any[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [savingContacts, setSavingContacts] = useState<Set<number>>(new Set());
  const [savedContacts, setSavedContacts] = useState<Set<number>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [verifyingContacts, setVerifyingContacts] = useState<Set<number>>(new Set());
  const [verifiedContacts, setVerifiedContacts] = useState<Set<number>>(new Set());

  const [generatingResearch, setGeneratingResearch] = useState(false);
  const [researchBrief, setResearchBrief] = useState<any>(null);
  const [researchError, setResearchError] = useState<string | null>(null);

  const { data, isLoading } = useSWR<ApiResponse<Company>>(
    `/companies/${companyId}`,
    (url: string) => apiGet<ApiResponse<Company>>(url)
  );

  const company = data?.data;

  // Discover contacts for this company
  const handleDiscoverContacts = async () => {
    setDiscoveringContacts(true);
    setContactsError(null);
    try {
      const result = await apiPost<any>(
        `/contacts/company/${companyId}/discover-personas`,
        {}
      );
      const contacts = result?.data?.suggestions || result?.suggestions || result?.data || [];
      setDiscoveredContacts(Array.isArray(contacts) ? contacts : []);
    } catch (err) {
      setContactsError(
        err instanceof Error ? err.message : "Failed to discover contacts"
      );
    } finally {
      setDiscoveringContacts(false);
    }
  };

  // Generate research for this company
  const handleGenerateResearch = async () => {
    setGeneratingResearch(true);
    setResearchError(null);
    try {
      const result = await apiPost<any>(
        `/research/company/${companyId}`,
        { brief_type: "company_summary" }
      );
      const brief = result?.data || result;
      setResearchBrief(brief);
    } catch (err) {
      setResearchError(
        err instanceof Error ? err.message : "Failed to generate research"
      );
    } finally {
      setGeneratingResearch(false);
    }
  };

  // Save a single discovered contact to the database
  const handleSaveContact = async (contact: any, idx: number) => {
    setSavingContacts((prev) => new Set(prev).add(idx));
    try {
      const firstName = contact.firstName || contact.first_name || "";
      const lastName = contact.lastName || contact.last_name || "";
      const payload = {
        company_id: companyId,
        first_name: firstName || null,
        last_name: lastName || null,
        email: contact.email || null,
        phone: contact.phone || null,
        job_title: contact.jobTitle || contact.job_title || contact.title || "",
        persona_type: contact.personaType || contact.persona_type || "other",
        linkedin_url: contact.linkedinUrl || contact.linkedin_url || null,
        source: contact.source === "apollo" ? "apollo" : "ai_discovery",
        notes: contact.reasoning || null,
      };
      await apiPost("/contacts", payload);
      setSavedContacts((prev) => new Set(prev).add(idx));
    } catch (err) {
      console.error("Failed to save contact:", err);
    } finally {
      setSavingContacts((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  // Save all discovered contacts at once
  const handleSaveAllContacts = async () => {
    setSavingAll(true);
    for (let i = 0; i < discoveredContacts.length; i++) {
      if (!savedContacts.has(i)) {
        await handleSaveContact(discoveredContacts[i], i);
      }
    }
    setSavingAll(false);
  };

  // Verify a single discovered contact via Apollo (1 credit)
  const handleVerifyApollo = async (contact: any, idx: number) => {
    if (!confirm(
      `Verify ${contact.firstName || contact.first_name || ""} ${contact.lastName || contact.last_name || ""} via Apollo?\n\n` +
      `This will use 1 Apollo credit to look up real verified email, LinkedIn, and phone.`
    )) return;

    setVerifyingContacts((prev) => new Set(prev).add(idx));
    try {
      const firstName = contact.firstName || contact.first_name || "";
      const lastName = contact.lastName || contact.last_name || "";
      const response = await apiPost<any>("/contacts/lookup-apollo", {
        first_name: firstName,
        last_name: lastName,
        company_name: company?.name,
        domain: company?.domain,
        linkedin_url: contact.linkedinUrl || contact.linkedin_url || null,
      });
      const data = response?.data ?? response;
      if (data?.found) {
        // Update the discovered contact in state with verified data
        setDiscoveredContacts((prev) => {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            email: data.email || next[idx].email,
            linkedin_url: data.linkedinUrl || data.linkedin_url || next[idx].linkedin_url,
            linkedinUrl: data.linkedinUrl || data.linkedin_url || next[idx].linkedinUrl,
            phone: data.phone || next[idx].phone,
            jobTitle: data.title || next[idx].jobTitle,
            job_title: data.title || next[idx].job_title,
            photoUrl: data.photoUrl || data.photo_url || next[idx].photoUrl,
            photo_url: data.photoUrl || data.photo_url || next[idx].photo_url,
            city: data.city || next[idx].city,
            country: data.country || next[idx].country,
            seniority: data.seniority || next[idx].seniority,
            source: "apollo",
          };
          return next;
        });
        setVerifiedContacts((prev) => new Set(prev).add(idx));
        alert(
          `✅ Verified via Apollo!\n\n` +
          `Email: ${data.email || "(not available)"}\n` +
          (data.title ? `Title: ${data.title}\n` : "") +
          (data.linkedinUrl || data.linkedin_url ? `LinkedIn: ${data.linkedinUrl || data.linkedin_url}\n` : "") +
          (data.phone ? `Phone: ${data.phone}` : "")
        );
      } else {
        alert(data?.message || "Person not found in Apollo database");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifyingContacts((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await apiDelete(`/companies/${companyId}`);
      router.push("/dashboard/companies");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete company"
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
            <div className="h-48 flex-1 rounded-xl bg-gray-100" />
            <div className="h-48 w-80 rounded-xl bg-gray-100" />
          </div>
          <div className="h-40 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-lg font-semibold text-gray-900">
          Company not found
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          The company you are looking for does not exist or was deleted.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard/companies")}
        >
          Back to Companies
        </Button>
      </div>
    );
  }

  const scoreBreakdown = company.scoreBreakdown ?? {};

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/companies")}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Companies
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {company.name}
              </h1>
              {company.industry && (
                <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-medium text-blue-700">
                  {company.industry}
                </span>
              )}
              {company.geography && (
                <span className="rounded-full bg-green-50 px-3 py-0.5 text-xs font-medium text-green-700">
                  {company.geography}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-4">
              {company.domain && (
                <a
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {company.domain}
                </a>
              )}
              {company.linkedinUrl && (
                <a
                  href={normaliseLinkedInUrl(company.linkedinUrl) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Re-score
            </Button>
            <Button variant="outline" size="sm">
              <Target className="mr-1.5 h-3.5 w-3.5" />
              Add to Strategy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                /* TODO: Edit modal */
              }}
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
                    Delete Company
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

      {/* Score + Info row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ICP Score Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            ICP Score
          </h2>
          <div className="flex items-center gap-4">
            <ScoreBadge score={company.icpScore} size="lg" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {company.icpScore ?? "N/A"}
              </p>
              <p className="text-xs text-gray-500">out of 100</p>
            </div>
          </div>

          {Object.keys(scoreBreakdown).length > 0 && (
            <div className="mt-6 space-y-3">
              {Object.entries(scoreBreakdown)
                .filter(([, val]) => typeof val === "number")
                .map(([key, val]) => (
                  <ScoreBar
                    key={key}
                    label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    value={val as number}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Company Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Company Details
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem label="Industry" value={company.industry} />
            <InfoItem label="Sub-Industry" value={company.subIndustry} />
            <InfoItem label="Geography" value={company.geography} />
            <InfoItem label="City" value={company.city} />
            <InfoItem label="Country" value={company.country} />
            <InfoItem
              label="Employees"
              value={
                company.employeeCount !== null
                  ? formatNumber(company.employeeCount)
                  : null
              }
            />
            <InfoItem label="Revenue Range" value={company.revenueRange} />
            <InfoItem
              label="Travel Intensity"
              value={
                company.travelIntensity
                  ? company.travelIntensity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  : null
              }
            />
            <InfoItem
              label="Source"
              value={
                <StatusBadge
                  status={company.source}
                  variantMap={{
                    manual: "bg-gray-100 text-gray-700",
                    discovery_agent: "bg-purple-50 text-purple-700",
                    import: "bg-blue-50 text-blue-700",
                  }}
                />
              }
            />
            <InfoItem label="Domain" value={company.domain} />
            <InfoItem
              label="Website"
              value={
                company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
                  >
                    {company.website}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null
              }
            />
            <InfoItem label="Added" value={formatDate(company.createdAt)} />
          </dl>
        </div>
      </div>

      {/* Google Maps / Apify Data */}
      {company.source === "google_maps" && Object.keys(scoreBreakdown).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Google Maps Data
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {typeof scoreBreakdown.phone === "string" && (
              <InfoItem
                label="Phone"
                value={
                  <a
                    href={`tel:${scoreBreakdown.phone}`}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    {scoreBreakdown.phone}
                  </a>
                }
              />
            )}
            {typeof scoreBreakdown.address === "string" && (
              <InfoItem
                label="Address"
                value={scoreBreakdown.address as string}
                span={2}
              />
            )}
            {typeof scoreBreakdown.total_score === "number" && (
              <InfoItem
                label="Rating"
                value={`★ ${(scoreBreakdown.total_score as number).toFixed(1)}`}
              />
            )}
            {typeof scoreBreakdown.reviews_count === "number" && (
              <InfoItem
                label="Reviews Count"
                value={(scoreBreakdown.reviews_count as number).toLocaleString()}
              />
            )}
            {Array.isArray(scoreBreakdown.categories) && scoreBreakdown.categories.length > 0 && (
              <InfoItem
                label="Categories"
                value={(scoreBreakdown.categories as string[]).join(", ")}
                span={2}
              />
            )}
            {typeof scoreBreakdown.place_id === "string" && (
              <InfoItem
                label="Google Place ID"
                value={
                  <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                    {scoreBreakdown.place_id as string}
                  </code>
                }
              />
            )}
            {scoreBreakdown.location &&
              typeof (scoreBreakdown.location as { lat?: number; lng?: number }).lat === "number" && (
                <InfoItem
                  label="Coordinates"
                  value={
                    <a
                      href={`https://www.google.com/maps?q=${(scoreBreakdown.location as { lat: number; lng: number }).lat},${(scoreBreakdown.location as { lat: number; lng: number }).lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
                    >
                      {(scoreBreakdown.location as { lat: number; lng: number }).lat.toFixed(4)},{" "}
                      {(scoreBreakdown.location as { lat: number; lng: number }).lng.toFixed(4)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  }
                />
              )}
          </dl>
        </div>
      )}

      {/* Contacts Section — AI Discovery */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Contacts
          </h2>
          <div className="flex items-center gap-2">
            {discoveredContacts.length > 0 && savedContacts.size < discoveredContacts.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAllContacts}
                disabled={savingAll}
              >
                {savingAll ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Save All to Contacts
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscoverContacts}
              disabled={discoveringContacts}
            >
              {discoveringContacts ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Discover Contacts
                </>
              )}
            </Button>
          </div>
        </div>

        {contactsError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {contactsError}
          </div>
        )}

        {discoveredContacts.length > 0 ? (
          <div className="mt-4 space-y-3">
            {discoveredContacts.map((contact: any, idx: number) => {
              const firstName = contact.firstName || contact.first_name || "";
              const lastName = contact.lastName || contact.last_name || "";
              const fullName = firstName && lastName ? `${firstName} ${lastName}` : (contact.name || contact.jobTitle || contact.job_title || "Unknown");
              const title = contact.jobTitle || contact.job_title || contact.title || "";
              const email = contact.email;
              const phone = contact.phone;
              const linkedin = contact.linkedinUrl || contact.linkedin_url;
              const photoUrl = contact.photoUrl || contact.photo_url;
              const source = contact.source || "ai";
              const seniority = contact.seniority;
              const city = contact.city;
              const country = contact.country;

              return (
                <div
                  key={idx}
                  className="rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={fullName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                          {firstName?.[0] || "?"}{lastName?.[0] || ""}
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-semibold text-gray-900">{fullName}</p>
                        <p className="text-xs text-gray-600">{title}</p>
                        {(city || country) && (
                          <p className="text-xs text-gray-400">{[city, country].filter(Boolean).join(", ")}</p>
                        )}

                        {/* Contact details */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3">
                          {email && (
                            <a
                              href={`mailto:${email}`}
                              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                            >
                              <span>📧</span> {email}
                            </a>
                          )}
                          {phone && (
                            <a
                              href={`tel:${phone}`}
                              className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                            >
                              <span>📞</span> {phone}
                            </a>
                          )}
                          {linkedin ? (
                            <a
                              href={normaliseLinkedInUrl(linkedin) ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                              title="Open verified LinkedIn profile"
                            >
                              <span>🔗</span> LinkedIn
                            </a>
                          ) : (fullName && fullName !== "Unknown") && (
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(
                                `site:linkedin.com/in "${fullName}" "${company?.name || ""}"`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
                              title="Find on LinkedIn via Google"
                            >
                              <span>🔍</span> Find on LinkedIn
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {seniority && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {seniority.replace(/_/g, " ")}
                        </span>
                      )}
                      {(contact.personaType || contact.persona_type) && (
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          {(contact.personaType || contact.persona_type || "").replace(/_/g, " ")}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        verifiedContacts.has(idx) || source === "apollo"
                          ? "bg-green-50 text-green-700"
                          : source === "web_scrape"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                      }`}>
                        {verifiedContacts.has(idx) || source === "apollo"
                          ? "✓ Verified (Apollo)"
                          : source === "web_scrape"
                            ? "🌐 From Team Page"
                            : "AI Suggested"}
                      </span>
                      {!verifiedContacts.has(idx) && source !== "apollo" && (
                        <button
                          onClick={() => handleVerifyApollo(contact, idx)}
                          disabled={verifyingContacts.has(idx)}
                          title="Use 1 Apollo credit to verify real email & LinkedIn"
                          className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          {verifyingContacts.has(idx) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3" />
                              <span>Verify (1 credit)</span>
                            </>
                          )}
                        </button>
                      )}
                      {savedContacts.has(idx) ? (
                        <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Saved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSaveContact(contact, idx)}
                          disabled={savingContacts.has(idx)}
                          className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                        >
                          {savingContacts.has(idx) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span>+ Save</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !discoveringContacts ? (
          <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Users className="h-6 w-6 text-gray-400" />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-600">
              No contacts yet
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Click &ldquo;Discover Contacts&rdquo; to use AI to find key people at this company.
            </p>
          </div>
        ) : null}
      </div>

      {/* Research Section — AI Generation */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Research Brief
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateResearch}
            disabled={generatingResearch}
          >
            {generatingResearch ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {researchBrief ? "Regenerate Research" : "Generate Research"}
              </>
            )}
          </Button>
        </div>

        {researchError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {researchError}
          </div>
        )}

        {researchBrief ? (
          <div className="mt-4 space-y-4">
            {/* Summary */}
            {(researchBrief.content?.summary || researchBrief.summary) && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Summary</h3>
                <p className="text-sm text-gray-700">
                  {researchBrief.content?.summary || researchBrief.summary}
                </p>
              </div>
            )}

            {/* Key Facts */}
            {((researchBrief.content?.keyFacts || researchBrief.content?.key_facts)?.length > 0) && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Key Facts</h3>
                <ul className="space-y-1">
                  {(researchBrief.content?.keyFacts || researchBrief.content?.key_facts || []).map(
                    (fact: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                        {fact}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            {/* Talking Points */}
            {((researchBrief.content?.talkingPoints || researchBrief.content?.talking_points)?.length > 0) && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Talking Points</h3>
                <ul className="space-y-1">
                  {(researchBrief.content?.talkingPoints || researchBrief.content?.talking_points || []).map(
                    (point: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                        {point}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            {/* Pain Points */}
            {((researchBrief.content?.painPoints || researchBrief.content?.pain_points)?.length > 0) && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Pain Points</h3>
                <ul className="space-y-1">
                  {(researchBrief.content?.painPoints || researchBrief.content?.pain_points || []).map(
                    (point: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-orange-700">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                        {point}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            {/* Opportunities */}
            {((researchBrief.content?.opportunities)?.length > 0) && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Opportunities</h3>
                <ul className="space-y-1">
                  {(researchBrief.content?.opportunities || []).map(
                    (opp: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                        {opp}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </div>
        ) : !generatingResearch ? (
          <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-6 w-6 text-gray-400" />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-600">
              No research brief
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Click &ldquo;Generate Research&rdquo; to use AI to create a research brief for this company.
            </p>
          </div>
        ) : null}
      </div>

      {/* Activity Log */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Activity Log
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
              <div className="h-2 w-2 rounded-full bg-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Company added
              </p>
              <p className="text-xs text-gray-500">
                Added via {company.source.replace(/_/g, " ")}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {formatDate(company.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Company"
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
              Delete Company
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete &ldquo;{company.name}&rdquo;? This
          will remove the company and all associated data permanently.
        </p>
      </Modal>
    </div>
  );
}
