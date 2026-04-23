"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users, Puzzle, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "General", href: "/dashboard/settings", icon: Settings },
  { label: "Team", href: "/dashboard/settings/team", icon: Users },
  { label: "Integrations", href: "/dashboard/settings/integrations", icon: Puzzle },
  { label: "Profile", href: "/dashboard/settings/profile", icon: UserCircle },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard/settings") {
      return pathname === "/dashboard/settings";
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account, team, and integrations.
        </p>
      </div>

      <nav className="mb-6 border-b border-gray-200">
        <div className="flex gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "text-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div>{children}</div>
    </div>
  );
}
