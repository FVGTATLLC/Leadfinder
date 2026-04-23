"use client";

import { useState } from "react";
import { Sparkles, Plus, UserPlus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { PersonaSuggestion } from "@/types/models";

const personaBadgeVariants: Record<string, string> = {
  procurement_head: "bg-indigo-50 text-indigo-700",
  admin: "bg-gray-100 text-gray-700",
  cfo: "bg-emerald-50 text-emerald-700",
  travel_manager: "bg-sky-50 text-sky-700",
  ceo: "bg-amber-50 text-amber-700",
  hr_head: "bg-pink-50 text-pink-700",
  other: "bg-slate-100 text-slate-600",
};

interface PersonaDiscoveryPanelProps {
  companyId: string;
  companyName: string;
  onAddContact?: (suggestion: PersonaSuggestion) => void;
  onAddAll?: (suggestions: PersonaSuggestion[]) => void;
}

export function PersonaDiscoveryPanel({
  companyId,
  companyName,
  onAddContact,
  onAddAll,
}: PersonaDiscoveryPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PersonaSuggestion[]>([]);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleDiscover = async () => {
    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setAddedIndices(new Set());
    try {
      const result = await apiPost<{ suggestions: PersonaSuggestion[] }>(
        `/companies/${companyId}/discover-personas`
      );
      setSuggestions(result.suggestions ?? []);
      setHasSearched(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to discover personas"
      );
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = (suggestion: PersonaSuggestion, index: number) => {
    onAddContact?.(suggestion);
    setAddedIndices((prev) => new Set(prev).add(index));
  };

  const handleAddAll = () => {
    onAddAll?.(suggestions);
    setAddedIndices(
      new Set(suggestions.map((_, i) => i))
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Persona Discovery
        </h2>
        {suggestions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddAll}
            disabled={addedIndices.size === suggestions.length}
          >
            <UserPlus className="mr-1 h-3.5 w-3.5" />
            Add All
          </Button>
        )}
      </div>

      {!hasSearched && !isLoading && (
        <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
            <Sparkles className="h-6 w-6 text-primary-500" />
          </div>
          <p className="mt-3 text-sm font-medium text-gray-600">
            Discover Decision-Makers
          </p>
          <p className="mt-1 max-w-sm text-xs text-gray-400">
            Use AI to identify key personas at {companyName} who are likely
            decision-makers for your offerings.
          </p>
          <Button className="mt-4" onClick={handleDiscover}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            Discover Decision-Makers
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:0ms]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:150ms]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:300ms]" />
          </div>
          <p className="mt-4 text-sm font-medium text-gray-700">
            Analyzing {companyName}...
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Identifying decision-makers and key contacts
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={handleDiscover}
              className="mt-1 text-xs font-medium text-red-600 hover:text-red-800"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!isLoading && hasSearched && suggestions.length === 0 && !error && (
        <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-gray-500">
            No decision-makers found for {companyName}.
          </p>
          <button
            onClick={handleDiscover}
            className="mt-2 text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            Try again
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-4 space-y-3">
          {suggestions.map((suggestion, index) => {
            const added = addedIndices.has(index);
            const pct = Math.round(suggestion.confidenceScore * 100);
            return (
              <div
                key={index}
                className={cn(
                  "rounded-lg border p-4 transition-colors",
                  added
                    ? "border-green-200 bg-green-50/50"
                    : "border-gray-200 bg-gray-50/50"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {suggestion.firstName} {suggestion.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {suggestion.jobTitle}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge
                        status={suggestion.personaType}
                        variantMap={personaBadgeVariants}
                      />
                      <span className="text-xs text-gray-500">
                        {pct}% confidence
                      </span>
                    </div>
                  </div>
                  <Button
                    variant={added ? "ghost" : "outline"}
                    size="sm"
                    disabled={added}
                    onClick={() => handleAdd(suggestion, index)}
                  >
                    {added ? (
                      <>Added</>
                    ) : (
                      <>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add Contact
                      </>
                    )}
                  </Button>
                </div>
                {suggestion.reasoning && (
                  <p className="mt-2 text-xs text-gray-400">
                    {suggestion.reasoning}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
