import {
  Bell,
  BotMessageSquare,
  ChartNoAxesCombined,
  Database,
  Eye,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  primaryMobile?: boolean;
}

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primaryMobile: true },
      { href: "/portfolio", label: "Portfolio", icon: Wallet, primaryMobile: true },
      { href: "/trading", label: "Trade journal", icon: NotebookPen },
      { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Market",
    items: [
      { href: "/watchlist", label: "Watchlist", icon: Eye, primaryMobile: true },
      { href: "/players", label: "Players & prices", icon: Users },
      { href: "/alerts", label: "Alerts", icon: Bell, primaryMobile: true },
      { href: "/ai-analyst", label: "AI analyst", icon: BotMessageSquare },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/data", label: "Import & export", icon: Database },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
