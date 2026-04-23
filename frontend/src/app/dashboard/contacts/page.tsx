"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  Plus,
  Download,
  Trash2,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SearchBar } from "@/components/common/search-bar";
import { ContactTable } from "@/components/contacts/contact-table";
import { ContactForm, type ContactFormData } from "@/components/contacts/contact-form";
import { BulkEnrichButton } from "@/components/contacts/bulk-enrich-button";
import { Pagination } from "@/components/common/pagination";
import {
  FilterPanel,
  type FilterConfig,
} from "@/components/common/filter-panel";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import type { Contact, Company } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";

const PERSONA_OPTIONS = [
  { label: "Procurement Head", value: "procurement_head" },
  { label: "Admin", value: "admin" },
  { label: "CFO", value: "cfo" },
  { label: "Travel Manager", value: "travel_manager" },
  { label: "CEO", value: "ceo" },
  { label: "HR Head", value: "hr_head" },
  { label: "Other", value: "other" },
];

const ENRICHMENT_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "Enriched", value: "enriched" },
  { label: "Failed", value: "failed" },
  { label: "Verified", value: "verified" },
];

interface FilterValues {
  [key: string]: string | string[] | { min: string; max: string };
}

export default function ContactsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [sortColumn, setSortColumn] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({});

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch companies for filter dropdown
  const { data: companiesData } = useSWR<PaginatedResponse<Company>>(
    "/companies?per_page=100",
    (url: string) => apiGet<PaginatedResponse<Company>>(url)
  );

  const companyOptions = (companiesData?.items ?? []).map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const FILTER_CONFIGS: FilterConfig[] = [
    {
      name: "Company",
      key: "company_id",
      type: "select",
      options: companyOptions,
      placeholder: "All Companies",
    },
    {
      name: "Persona Type",
      key: "persona_type",
      type: "multi-select",
      options: PERSONA_OPTIONS,
    },
    {
      name: "Enrichment Status",
      key: "enrichment_status",
      type: "multi-select",
      options: ENRICHMENT_OPTIONS,
    },
  ];

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", String(perPage));
    params.set("sort", sortColumn);
    params.set("direction", sortDirection);
    if (search) params.set("search", search);

    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        params.set(key, value);
      } else if (Array.isArray(value) && value.length > 0) {
        params.set(key, value.join(","));
      } else if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        if (value.min) params.set(`${key}_min`, value.min);
        if (value.max) params.set(`${key}_max`, value.max);
      }
    });

    return params.toString();
  }, [page, perPage, sortColumn, sortDirection, search, appliedFilters]);

  const queryKey = `/contacts?${buildQueryString()}`;

  const { data, isLoading } = useSWR<PaginatedResponse<Contact>>(
    queryKey,
    (url: string) => apiGet<PaginatedResponse<Contact>>(url)
  );

  const contacts = data?.items ?? [];
  const total = data?.total ?? 0;

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filterValues });
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilterValues({});
    setAppliedFilters({});
    setPage(1);
  };

  const handleCreateContact = async (formData: ContactFormData) => {
    setFormLoading(true);
    try {
      await apiPost("/contacts", formData);
      setIsCreateOpen(false);
      mutate(queryKey);
    } catch {
      // Error handled by form
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditContact = async (formData: ContactFormData) => {
    if (!editingContact) return;
    setFormLoading(true);
    try {
      await apiPost(`/contacts/${editingContact.id}`, formData);
      setEditingContact(null);
      mutate(queryKey);
    } catch {
      // Error handled by form
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!deletingContact) return;
    setDeleteLoading(true);
    try {
      await apiDelete(`/contacts/${deletingContact.id}`);
      setDeletingContact(null);
      setIsDeleteOpen(false);
      mutate(queryKey);
    } catch {
      // Error handled
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkComplete = () => {
    setSelectedIds(new Set());
    mutate(queryKey);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your contact database, enrich profiles, and track
            decision-makers.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Search */}
      <SearchBar
        placeholder="Search by name, email, or job title..."
        value={search}
        onChange={handleSearch}
        className="max-w-md"
      />

      {/* Filters */}
      <FilterPanel
        filters={FILTER_CONFIGS}
        values={filterValues}
        onChange={setFilterValues}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
          <span className="text-sm font-medium text-primary-700">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <BulkEnrichButton
              selectedContactIds={Array.from(selectedIds)}
              onComplete={handleBulkComplete}
            />
            <Button variant="outline" size="sm">
              <Download className="mr-1 h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="danger" size="sm">
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-primary-600 hover:text-primary-800"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && contacts.length === 0 && !search && Object.keys(appliedFilters).length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Users className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            No contacts yet
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-gray-500">
            Add contacts manually or discover them from company pages.
          </p>
          <Button className="mt-5" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      )}

      {/* Table (show when there are contacts or search/filters active) */}
      {(isLoading || contacts.length > 0 || search || Object.keys(appliedFilters).length > 0) && (
        <>
          <ContactTable
            contacts={contacts}
            isLoading={isLoading}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            selectable
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
            onEnrich={() => {
              /* TODO: single enrich */
            }}
            onVerify={async (contact) => {
              try {
                const response = await apiPost<any>(`/contacts/${contact.id}/verify-apollo`);
                const result = response?.data ?? response;
                const apolloData = result?.apolloData ?? result?.apollo_data;
                if (result?.verified) {
                  alert(
                    `✅ Contact verified via Apollo!\n\n` +
                    `Email: ${apolloData?.email ?? contact.email ?? "(unchanged)"}\n` +
                    (apolloData?.title ? `Title: ${apolloData.title}\n` : "") +
                    (apolloData?.linkedin ? `LinkedIn: ${apolloData.linkedin}\n` : "") +
                    (apolloData?.phone ? `Phone: ${apolloData.phone}` : "")
                  );
                } else {
                  alert(result?.message ?? "Contact not found in Apollo database");
                }
                mutate(queryKey);
              } catch {
                alert("Failed to verify contact with Apollo");
              }
            }}
            onEdit={(contact) => setEditingContact(contact)}
            onDelete={(contact) => {
              setDeletingContact(contact);
              setIsDeleteOpen(true);
            }}
          />

          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={(pp) => {
              setPerPage(pp);
              setPage(1);
            }}
          />
        </>
      )}

      {/* Create Contact Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Contact"
        size="lg"
      >
        <ContactForm
          onSubmit={handleCreateContact}
          isLoading={formLoading}
        />
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        isOpen={!!editingContact}
        onClose={() => setEditingContact(null)}
        title="Edit Contact"
        size="lg"
      >
        {editingContact && (
          <ContactForm
            initialData={editingContact}
            onSubmit={handleEditContact}
            isLoading={formLoading}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteOpen && !!deletingContact}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingContact(null);
        }}
        title="Delete Contact"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOpen(false);
                setDeletingContact(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteContact}
              isLoading={deleteLoading}
            >
              Delete Contact
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{" "}
          <span className="font-semibold">
            {deletingContact?.firstName} {deletingContact?.lastName}
          </span>
          ? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
