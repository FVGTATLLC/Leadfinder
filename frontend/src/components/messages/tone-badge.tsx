import { Briefcase, Smile, Lightbulb, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const toneConfig: Record<
  string,
  { color: string; icon: React.ElementType; label: string }
> = {
  formal: {
    color: "bg-slate-100 text-slate-700",
    icon: Briefcase,
    label: "Formal",
  },
  friendly: {
    color: "bg-emerald-50 text-emerald-700",
    icon: Smile,
    label: "Friendly",
  },
  consultative: {
    color: "bg-blue-50 text-blue-700",
    icon: Lightbulb,
    label: "Consultative",
  },
  aggressive: {
    color: "bg-orange-50 text-orange-700",
    icon: Zap,
    label: "Aggressive",
  },
};

interface ToneBadgeProps {
  tone: string;
  className?: string;
}

export function ToneBadge({ tone, className }: ToneBadgeProps) {
  const config = toneConfig[tone] ?? {
    color: "bg-gray-100 text-gray-700",
    icon: Briefcase,
    label: tone,
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        config.color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
