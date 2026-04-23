"use client";

import { Briefcase, Smile, Lightbulb, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { TonePreset } from "@/types/models";

interface ToneSelectorProps {
  value: TonePreset | "";
  onChange: (value: TonePreset) => void;
}

const toneOptions = [
  {
    value: TonePreset.FORMAL,
    label: "Formal",
    description: "Professional and structured",
    icon: Briefcase,
    color: "border-slate-300 bg-slate-50 text-slate-700",
    selectedColor: "border-slate-600 bg-slate-100 ring-2 ring-slate-600/20",
    iconColor: "text-slate-600",
  },
  {
    value: TonePreset.FRIENDLY,
    label: "Friendly",
    description: "Warm and approachable",
    icon: Smile,
    color: "border-amber-300 bg-amber-50 text-amber-700",
    selectedColor: "border-amber-600 bg-amber-100 ring-2 ring-amber-600/20",
    iconColor: "text-amber-600",
  },
  {
    value: TonePreset.CONSULTATIVE,
    label: "Consultative",
    description: "Expert and advisory",
    icon: Lightbulb,
    color: "border-primary-300 bg-primary-50 text-primary-700",
    selectedColor: "border-primary-600 bg-primary-100 ring-2 ring-primary-600/20",
    iconColor: "text-primary-600",
    recommended: true,
  },
  {
    value: TonePreset.AGGRESSIVE,
    label: "Aggressive",
    description: "Bold and direct",
    icon: Zap,
    color: "border-red-300 bg-red-50 text-red-700",
    selectedColor: "border-red-600 bg-red-100 ring-2 ring-red-600/20",
    iconColor: "text-red-600",
  },
];

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {toneOptions.map((tone) => {
        const Icon = tone.icon;
        const isSelected = value === tone.value;
        return (
          <button
            key={tone.value}
            type="button"
            onClick={() => onChange(tone.value)}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:shadow-md",
              isSelected ? tone.selectedColor : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            {tone.recommended && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                Recommended
              </span>
            )}
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                isSelected ? tone.color : "bg-gray-100"
              )}
            >
              <Icon className={cn("h-5 w-5", isSelected ? tone.iconColor : "text-gray-500")} />
            </div>
            <div className="text-center">
              <p className={cn("text-sm font-semibold", isSelected ? "text-gray-900" : "text-gray-700")}>
                {tone.label}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{tone.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
