"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api";
import type { Company } from "@/types/models";

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const INDUSTRY_OPTIONS = [
  "Technology",
  "Financial Services",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Consulting",
  "Logistics",
  "Hospitality",
  "Insurance",
  "Pharmaceuticals",
  "Energy",
  "Telecommunications",
];

const GEOGRAPHY_OPTIONS = [
  "North America",
  "Europe",
  "Asia Pacific",
  "Latin America",
  "Middle East",
  "Africa",
];

const TRAVEL_INTENSITY_OPTIONS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Very High", value: "very_high" },
];

export function AddCompanyModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCompanyModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    domain: "",
    industry: "",
    geography: "",
    country: "",
    city: "",
    employeeCount: "",
    revenueRange: "",
    travelIntensity: "",
    website: "",
    linkedinUrl: "",
  });

  const resetForm = () => {
    setForm({
      name: "",
      domain: "",
      industry: "",
      geography: "",
      country: "",
      city: "",
      employeeCount: "",
      revenueRange: "",
      travelIntensity: "",
      website: "",
      linkedinUrl: "",
    });
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Company name is required");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await apiPost<ApiResponse<Company>>("/companies", {
        name: form.name.trim(),
        domain: form.domain.trim() || null,
        industry: form.industry || null,
        geography: form.geography || null,
        country: form.country.trim() || null,
        city: form.city.trim() || null,
        employee_count: form.employeeCount ? Number(form.employeeCount) : null,
        revenue_range: form.revenueRange.trim() || null,
        travel_intensity: form.travelIntensity || null,
        website: form.website.trim() || null,
        linkedin_url: form.linkedinUrl.trim() || null,
        source: "manual",
      });
      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create company";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Company"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>
            Add Company
          </Button>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Input
          label="Company Name *"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g., Acme Corp"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Domain"
            value={form.domain}
            onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
            placeholder="e.g., acme.com"
          />
          <Input
            label="Website"
            value={form.website}
            onChange={(e) =>
              setForm((f) => ({ ...f, website: e.target.value }))
            }
            placeholder="e.g., https://acme.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Industry
            </label>
            <select
              value={form.industry}
              onChange={(e) =>
                setForm((f) => ({ ...f, industry: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Select industry...</option>
              {INDUSTRY_OPTIONS.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Geography
            </label>
            <select
              value={form.geography}
              onChange={(e) =>
                setForm((f) => ({ ...f, geography: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Select geography...</option>
              {GEOGRAPHY_OPTIONS.map((geo) => (
                <option key={geo} value={geo}>
                  {geo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Country"
            value={form.country}
            onChange={(e) =>
              setForm((f) => ({ ...f, country: e.target.value }))
            }
            placeholder="e.g., United States"
          />
          <Input
            label="City"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="e.g., New York"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Employee Count"
            type="number"
            value={form.employeeCount}
            onChange={(e) =>
              setForm((f) => ({ ...f, employeeCount: e.target.value }))
            }
            placeholder="e.g., 500"
          />
          <Input
            label="Revenue Range"
            value={form.revenueRange}
            onChange={(e) =>
              setForm((f) => ({ ...f, revenueRange: e.target.value }))
            }
            placeholder="e.g., $10M-$50M"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Travel Intensity
            </label>
            <select
              value={form.travelIntensity}
              onChange={(e) =>
                setForm((f) => ({ ...f, travelIntensity: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Select...</option>
              {TRAVEL_INTENSITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="LinkedIn URL"
            value={form.linkedinUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, linkedinUrl: e.target.value }))
            }
            placeholder="e.g., https://linkedin.com/company/acme"
          />
        </div>
      </div>
    </Modal>
  );
}
