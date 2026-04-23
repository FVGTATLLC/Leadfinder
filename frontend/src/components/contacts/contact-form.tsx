"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PersonaSelector } from "@/components/contacts/persona-selector";
import { apiGet } from "@/lib/api-client";
import { PersonaType } from "@/types/models";
import type { Contact, Company } from "@/types/models";
import type { PaginatedResponse } from "@/types/api";

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  personaType: PersonaType | null;
  linkedinUrl: string;
  companyId: string;
  notes: string;
  isPrimary: boolean;
}

interface ContactFormProps {
  initialData?: Partial<Contact>;
  companyId?: string;
  onSubmit: (data: ContactFormData) => void;
  isLoading?: boolean;
}

const INITIAL_FORM: ContactFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  personaType: null,
  linkedinUrl: "",
  companyId: "",
  notes: "",
  isPrimary: false,
};

function validateEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ContactForm({
  initialData,
  companyId,
  onSubmit,
  isLoading = false,
}: ContactFormProps) {
  const [form, setForm] = useState<ContactFormData>(() => ({
    ...INITIAL_FORM,
    ...(initialData
      ? {
          firstName: initialData.firstName ?? "",
          lastName: initialData.lastName ?? "",
          email: initialData.email ?? "",
          phone: initialData.phone ?? "",
          jobTitle: initialData.jobTitle ?? "",
          personaType: initialData.personaType ?? null,
          linkedinUrl: initialData.linkedinUrl ?? "",
          companyId: initialData.companyId ?? "",
          notes: initialData.notes ?? "",
          isPrimary: initialData.isPrimary ?? false,
        }
      : {}),
    ...(companyId ? { companyId } : {}),
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companySearch, setCompanySearch] = useState("");

  const { data: companiesData } = useSWR<PaginatedResponse<Company>>(
    !companyId ? `/companies?search=${companySearch}&per_page=20` : null,
    (url: string) => apiGet<PaginatedResponse<Company>>(url)
  );

  const companies = companiesData?.items ?? [];

  const updateField = useCallback(
    <K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.firstName.trim() && !form.lastName.trim()) {
      newErrors.firstName = "At least first name or last name is required";
      newErrors.lastName = "At least first name or last name is required";
    }

    if (form.email && !validateEmail(form.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(form);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="First Name"
          placeholder="John"
          value={form.firstName}
          onChange={(e) => updateField("firstName", e.target.value)}
          error={errors.firstName}
        />
        <Input
          label="Last Name"
          placeholder="Doe"
          value={form.lastName}
          onChange={(e) => updateField("lastName", e.target.value)}
          error={errors.lastName}
        />
      </div>

      <Input
        label="Email"
        type="email"
        placeholder="john.doe@clubconcierge.com"
        value={form.email}
        onChange={(e) => updateField("email", e.target.value)}
        error={errors.email}
      />

      <Input
        label="Phone"
        type="tel"
        placeholder="+1 (555) 123-4567"
        value={form.phone}
        onChange={(e) => updateField("phone", e.target.value)}
      />

      <Input
        label="Job Title"
        placeholder="Head of Procurement"
        value={form.jobTitle}
        onChange={(e) => updateField("jobTitle", e.target.value)}
      />

      <PersonaSelector
        value={form.personaType}
        onChange={(val) => updateField("personaType", val)}
      />

      <Input
        label="LinkedIn URL"
        placeholder="https://linkedin.com/in/johndoe"
        value={form.linkedinUrl}
        onChange={(e) => updateField("linkedinUrl", e.target.value)}
      />

      {/* Company selector */}
      {!companyId && (
        <div className="w-full">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Company
          </label>
          <select
            value={form.companyId}
            onChange={(e) => updateField("companyId", e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Select a company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="w-full">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Additional notes about this contact..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.isPrimary}
          onChange={(e) => updateField("isPrimary", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        Set as primary contact for the company
      </label>

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {initialData ? "Update Contact" : "Create Contact"}
        </Button>
      </div>
    </form>
  );
}
