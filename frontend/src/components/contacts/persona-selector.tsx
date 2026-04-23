"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ShoppingCart,
  Shield,
  DollarSign,
  Plane,
  Crown,
  UserCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonaType } from "@/types/models";

interface PersonaOption {
  value: PersonaType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const PERSONA_OPTIONS: PersonaOption[] = [
  {
    value: PersonaType.PROCUREMENT_HEAD,
    label: "Procurement Head",
    description: "Handles vendor selection and purchasing decisions",
    icon: ShoppingCart,
  },
  {
    value: PersonaType.ADMIN,
    label: "Admin",
    description: "Office and administrative operations management",
    icon: Shield,
  },
  {
    value: PersonaType.CFO,
    label: "CFO",
    description: "Financial decision-maker and budget authority",
    icon: DollarSign,
  },
  {
    value: PersonaType.TRAVEL_MANAGER,
    label: "Travel Manager",
    description: "Manages corporate travel programs and policies",
    icon: Plane,
  },
  {
    value: PersonaType.CEO,
    label: "CEO",
    description: "Chief executive and strategic decision-maker",
    icon: Crown,
  },
  {
    value: PersonaType.HR_HEAD,
    label: "HR Head",
    description: "Human resources and people operations leader",
    icon: UserCheck,
  },
  {
    value: PersonaType.OTHER,
    label: "Other",
    description: "Other role or persona type",
    icon: Users,
  },
];

interface PersonaSelectorProps {
  value: PersonaType | null;
  onChange: (value: PersonaType) => void;
  error?: string;
  className?: string;
}

export function PersonaSelector({
  value,
  onChange,
  error,
  className,
}: PersonaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = PERSONA_OPTIONS.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        Persona Type
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border bg-white px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-gray-300 focus:border-primary-500 focus:ring-primary-500/20"
          )}
        >
          {selected ? (
            <div className="flex items-center gap-2">
              <selected.icon className="h-4 w-4 text-gray-500" />
              <span className="text-gray-900">{selected.label}</span>
            </div>
          ) : (
            <span className="text-gray-400">Select persona type</span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {PERSONA_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-gray-50",
                    isSelected && "bg-primary-50"
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 flex-shrink-0",
                      isSelected ? "text-primary-600" : "text-gray-400"
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isSelected ? "text-primary-700" : "text-gray-900"
                      )}
                    >
                      {option.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export { PERSONA_OPTIONS };
