"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/common/tag-input";
import type { StrategyFilters } from "@/types/models";

interface StrategyFormData {
  name: string;
  description: string;
  filters: StrategyFilters;
}

interface StrategyFormProps {
  initialData?: StrategyFormData;
  onSubmit: (data: StrategyFormData, activate: boolean) => void;
  isLoading?: boolean;
}

const SEARCH_TERM_SUGGESTIONS = [
  "Travel agency",
  "Tour operator",
  "Hotel",
  "Restaurant",
  "Real estate agent",
  "Law firm",
  "Marketing agency",
  "Recruitment agency",
  "Construction company",
  "Event planner",
  "Logistics company",
  "Consulting firm",
  "Retail store",
  "Medical clinic",
  "Fitness center",
  "Car dealership",
  "Wedding planner",
];

const LOCATION_SUGGESTIONS = [
  "Lagos, Nigeria",
  "Abuja, Nigeria",
  "Port Harcourt, Nigeria",
  "Dubai, UAE",
  "Abu Dhabi, UAE",
  "Mumbai, India",
  "Delhi, India",
  "Bangalore, India",
  "Nairobi, Kenya",
  "Johannesburg, South Africa",
  "Cairo, Egypt",
  "Accra, Ghana",
  "London, UK",
  "New York, USA",
];

const emptyFilters: StrategyFilters = {
  industry: [],
  city: [],
  maxPerSearch: 50,
  revenueMin: null,
  revenueMax: null,
  employeeMin: null,
  employeeMax: null,
  travelIntensity: [],
  customTags: [],
};

export function StrategyForm({
  initialData,
  onSubmit,
  isLoading = false,
}: StrategyFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [filters, setFilters] = useState<StrategyFilters>(
    initialData?.filters ?? emptyFilters
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "Strategy name is required";
    }
    if (!filters.industry.length) {
      newErrors.industry = "Add at least one search term";
    }
    if (!filters.city.length) {
      newErrors.city = "Add at least one location";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (activate: boolean) => {
    if (!validate()) return;
    onSubmit({ name: name.trim(), description: description.trim(), filters }, activate);
  };

  const updateFilter = <K extends keyof StrategyFilters>(
    key: K,
    value: StrategyFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-8">
      {/* Basic Info */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Basic Information
        </h3>
        <div className="space-y-4">
          <Input
            label="Strategy Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
            }}
            placeholder="e.g., Dubai Travel Agencies"
            error={errors.name}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this strategy and its goals..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
      </section>

      {/* Search Terms (Google Maps search queries) */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Search Terms
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          What businesses to find on Google Maps. Each term triggers a separate search.
        </p>
        <TagInput
          value={filters.industry}
          onChange={(val) => {
            updateFilter("industry", val);
            if (errors.industry) setErrors((prev) => ({ ...prev, industry: "" }));
          }}
          placeholder="e.g., travel agency, tour operator..."
          suggestions={SEARCH_TERM_SUGGESTIONS}
          tagColor="bg-blue-50 text-blue-700"
        />
        {errors.industry && (
          <p className="mt-1.5 text-xs text-red-600">{errors.industry}</p>
        )}
      </section>

      {/* Location (Google Maps location query) */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Location
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          City, region, or country to search within. Multiple values run separate searches.
        </p>
        <TagInput
          value={filters.city}
          onChange={(val) => {
            updateFilter("city", val);
            if (errors.city) setErrors((prev) => ({ ...prev, city: "" }));
          }}
          placeholder="e.g., Dubai, UAE..."
          suggestions={LOCATION_SUGGESTIONS}
          tagColor="bg-green-50 text-green-700"
        />
        {errors.city && (
          <p className="mt-1.5 text-xs text-red-600">{errors.city}</p>
        )}
      </section>

      {/* Number of places to extract */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Number of Places to Extract
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          How many results to pull from Google Maps for each search term
          (1 – 500). Higher numbers take longer and cost more Apify credits.
        </p>
        <Input
          type="number"
          min={1}
          max={500}
          value={filters.maxPerSearch ?? 50}
          onChange={(e) => {
            const n = Number(e.target.value);
            updateFilter(
              "maxPerSearch",
              Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 50
            );
          }}
          placeholder="50"
        />
      </section>

      {/* Custom Tags */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Custom Tags
        </h3>
        <TagInput
          value={filters.customTags}
          onChange={(val) => updateFilter("customTags", val)}
          placeholder="Add custom tags to refine targeting..."
          tagColor="bg-gray-100 text-gray-700"
        />
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
        <Button
          variant="outline"
          onClick={() => handleSubmit(false)}
          isLoading={isLoading}
        >
          Save as Draft
        </Button>
        <Button onClick={() => handleSubmit(true)} isLoading={isLoading}>
          Save &amp; Activate
        </Button>
      </div>
    </div>
  );
}
