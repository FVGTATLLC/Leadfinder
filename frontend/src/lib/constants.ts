import {
  LayoutDashboard,
  Target,
  Building2,
  Users,
  Send,
  MessageSquare,
  Search,
  BarChart3,
  Download,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";

export const APP_NAME = "SalesPilot";

export const USER_ROLES = {
  admin: { label: "Admin", description: "Full platform access" },
  manager: { label: "Manager", description: "Team management access" },
  sales_rep: { label: "Sales Rep", description: "Standard sales access" },
  viewer: { label: "Viewer", description: "Read-only access" },
} as const;

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  adminOnly?: boolean;
}

export const NAVIGATION_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Strategies", href: "/dashboard/strategies", icon: Target },
  { label: "Companies", href: "/dashboard/companies", icon: Building2 },
  { label: "Contacts", href: "/dashboard/contacts", icon: Users },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Send },
  { label: "Messages", href: "/dashboard/messages", icon: MessageSquare },
  { label: "Research", href: "/dashboard/research", icon: Search },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Exports", href: "/dashboard/exports", icon: Download },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Admin", href: "/dashboard/admin", icon: Shield, adminOnly: true },
];
