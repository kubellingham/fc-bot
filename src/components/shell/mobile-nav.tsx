"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Brand } from "@/components/brand";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ALL_NAV_ITEMS, isActive } from "./nav-items";
import { NavList } from "./sidebar";

/** Bottom tab bar for phones: quick portfolio checks, watchlist and alerts. */
export function MobileNav({ unreadAlerts }: { unreadAlerts: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = ALL_NAV_ITEMS.filter((i) => i.primaryMobile);
  const moreActive = !primary.some((i) => isActive(pathname, i.href));

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {primary.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2 text-[11px]",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-5" aria-hidden="true" />
            {item.label}
            {item.href === "/alerts" && unreadAlerts > 0 && (
              <span className="absolute top-1.5 left-1/2 ml-2 size-2 rounded-full bg-primary" aria-label={`${unreadAlerts} unread`} />
            )}
          </Link>
        );
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", moreActive ? "text-primary" : "text-muted-foreground")}
        >
          <Menu className="size-5" aria-hidden="true" />
          More
        </SheetTrigger>
        <SheetContent side="right" className="overflow-y-auto p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">All sections of FC Market Intelligence</SheetDescription>
          <Brand href="/dashboard" className="mb-2 px-2 text-sm" />
          <NavList unreadAlerts={unreadAlerts} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </nav>
  );
}
