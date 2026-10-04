import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M8 21.5 13 15l4 3.5L24 10"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="10" r="2" className="fill-primary-foreground" />
    </svg>
  );
}

export function Brand({ href = "/", className, compact = false }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <BrandMark />
      {!compact && (
        <span className="leading-tight">
          FC Market <span className="text-muted-foreground font-normal">Intelligence</span>
        </span>
      )}
    </Link>
  );
}
