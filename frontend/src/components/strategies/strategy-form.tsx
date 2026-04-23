"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/common/tag-input";
import type { StrategyFilters } from "@/types/models";
import { TravelIntensity } from "@/types/models";

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

const INDUSTRY_SUGGESTIONS = [
  // === Financial & Banking ===
  "Banking",
  "Financial Services",
  "Insurance",
  "Investment Management",
  "Private Equity & Venture Capital",
  "Microfinance",
  "Fintech",
  // === Energy & Resources ===
  "Oil & Gas",
  "Mining & Metals",
  "Renewable Energy",
  "Energy & Utilities",
  "Water & Sanitation",
  // === Technology & Telecom ===
  "Technology",
  "Software & IT Services",
  "Telecommunications",
  "Cybersecurity",
  "Cloud Computing",
  "Artificial Intelligence",
  // === Manufacturing & Industrial ===
  "Manufacturing",
  "Automotive",
  "Aerospace & Defense",
  "Chemicals",
  "Construction & Engineering",
  "Building Materials",
  "Cement & Concrete",
  "Steel & Iron",
  "Textiles & Apparel",
  "Packaging",
  // === Consumer & Retail ===
  "Retail",
  "FMCG / Consumer Goods",
  "Food & Beverage",
  "Luxury Goods",
  "E-Commerce",
  // === Healthcare & Pharma ===
  "Healthcare",
  "Pharmaceuticals",
  "Medical Devices",
  "Hospitals & Clinics",
  "Biotechnology",
  // === Transport & Logistics ===
  "Airlines & Aviation",
  "Shipping & Maritime",
  "Logistics & Supply Chain",
  "Freight & Cargo",
  "Transportation",
  "Ports & Terminals",
  // === Agriculture & Food ===
  "Agriculture",
  "Agribusiness",
  "Fertilizers & Agrochemicals",
  "Food Processing",
  "Livestock & Poultry",
  // === Real Estate & Infrastructure ===
  "Real Estate",
  "Property Development",
  "Infrastructure",
  "Smart Cities",
  // === Professional Services ===
  "Consulting",
  "Legal Services",
  "Accounting & Audit",
  "Advertising & Marketing",
  "PR & Communications",
  "Recruitment & HR Services",
  // === Hospitality & Tourism ===
  "Hospitality",
  "Hotels & Resorts",
  "Travel & Tourism",
  "MICE & Events",
  "Restaurants & Catering",
  // === Media & Entertainment ===
  "Media & Entertainment",
  "Broadcasting",
  "Publishing",
  "Sports & Recreation",
  "Gaming",
  // === Government & NGO ===
  "Government & Public Sector",
  "International Organizations",
  "NGOs & Non-Profit",
  "Development Agencies",
  "Diplomatic & Embassies",
  // === Education & Research ===
  "Education",
  "Higher Education",
  "EdTech",
  "Research & Development",
  // === Other ===
  "Conglomerate",
  "Trading & Distribution",
  "Environmental Services",
  "Waste Management",
  "Security Services",
  "Religious & Faith-Based",
  "Hajj & Umrah Services",
];

const CITY_SUGGESTIONS = [
  "Lagos",
  "Abuja",
  "Port Harcourt",
  "Kano",
  "Ibadan",
  "Kaduna",
  "Enugu",
  "Warri",
  "Calabar",
  "Benin City",
  "Owerri",
  "Jos",
  "Uyo",
  "Abeokuta",
  "Onitsha",
];

const TRAVEL_INTENSITY_OPTIONS = [
  { label: "Low", value: TravelIntensity.LOW },
  { label: "Medium", value: TravelIntensity.MEDIUM },
  { label: "High", value: TravelIntensity.HIGH },
  { label: "Very High", value: TravelIntensity.VERY_HIGH },
];

const emptyFilters: StrategyFilters = {
  industry: [],
  city: [],
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

  const toggleTravelIntensity = (val: string) => {
    setFilters((prev) => ({
      ...prev,
      travelIntensity: prev.travelIntensity.includes(val)
        ? prev.travelIntensity.filter((v) => v !== val)
        : [...prev.travelIntensity, val],
    }));
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
            placeholder="e.g., Enterprise SaaS Companies in North America"
            error={errors.name}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this ICP strategy and its goals..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
      </section>

      {/* Industry Filter */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Industry Filter
        </h3>
        <TagInput
          value={filters.industry}
          onChange={(val) => updateFilter("industry", val)}
          placeholder="Add target industries..."
          suggestions={INDUSTRY_SUGGESTIONS}
          tagColor="bg-blue-50 text-blue-700"
        />
      </section>

      {/* City Filter */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          City Filter
        </h3>
        <TagInput
          value={filters.city}
          onChange={(val) => updateFilter("city", val)}
          placeholder="Add target cities..."
          suggestions={CITY_SUGGESTIONS}
          tagColor="bg-green-50 text-green-700"
        />
      </section>

      {/* Company Size */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Company Size (Employees)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Minimum Employees"
            type="number"
            value={filters.employeeMin ?? ""}
            onChange={(e) =>
              updateFilter(
                "employeeMin",
                e.target.value ? Number(e.target.value) : null
              )
            }
            placeholder="e.g., 50"
          />
          <Input
            label="Maximum Employees"
            type="number"
            value={filters.employeeMax ?? ""}
            onChange={(e) =>
              updateFilter(
                "employeeMax",
                e.target.value ? Number(e.target.value) : null
              )
            }
            placeholder="e.g., 5000"
          />
        </div>
      </section>

      {/* Revenue Range */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Revenue Range
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Minimum Revenue ($)"
            type="number"
            value={filters.revenueMin ?? ""}
            onChange={(e) =>
              updateFilter(
                "revenueMin",
                e.target.value ? Number(e.target.value) : null
              )
            }
            placeholder="e.g., 1000000"
          />
          <Input
            label="Maximum Revenue ($)"
            type="number"
            value={filters.revenueMax ?? ""}
            onChange={(e) =>
              updateFilter(
                "revenueMax",
                e.target.value ? Number(e.target.value) : null
              )
            }
            placeholder="e.g., 100000000"
          />
        </div>
      </section>

      {/* Travel Intensity */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Travel Intensity
        </h3>
        <div className="flex flex-wrap gap-3">
          {TRAVEL_INTENSITY_OPTIONS.map((option) => {
            const checked = filters.travelIntensity.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTravelIntensity(option.value)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className={checked ? "font-medium text-gray-900" : "text-gray-600"}>
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
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
