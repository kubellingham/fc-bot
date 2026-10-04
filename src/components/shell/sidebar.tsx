"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, isActive } from "./nav-items";

export function NavList({ unreadAlerts, onNavigate }: { unreadAlerts: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="grid gap-5">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="grid gap-0.5">
          <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{section.label}</p>
          {section.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className={cn("size-4", active && "text-primary")} aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/alerts" && unreadAlerts > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground">
                    {unreadAlerts > 99 ? "99+" : unreadAlerts}
                    <span className="sr-only"> unread alerts</span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ unreadAlerts }: { unreadAlerts: number }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
      <Brand href="/dashboard" className="px-2 text-sm" />
      <NavList unreadAlerts={unreadAlerts} />
      <div className="mt-auto rounded-lg border bg-card/50 p-3 text-xs text-muted-foreground">
        Companion tool only. Trades are made by you, in game. Prices shown are the ones you record.
      </div>
    </aside>
  );
}
