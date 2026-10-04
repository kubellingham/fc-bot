import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * A stat tile: the number is the chart. Hero values use proportional figures
 * (no tabular-nums) per the data-viz guidelines.
 */
export function KpiCard({
  label,
  value,
  sub,
  info,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  info?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-2 py-4", className)}>
      <div className="flex items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {icon}
          <span>{label}</span>
        </div>
        {info && (
          <Tooltip>
            <TooltipTrigger
              className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`About ${label}`}
            >
              <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>{info}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="px-4 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="px-4 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
