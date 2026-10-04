"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { playerLabel, type Player } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type PickerPlayer = Pick<Player, "id" | "name" | "version" | "rating" | "position" | "club">;

/** Searchable, keyboard-accessible player selector (ARIA combobox pattern). */
export const PlayerPicker = React.forwardRef<
  HTMLButtonElement,
  {
    id: string;
    players: PickerPlayer[];
    value: string | undefined;
    onChange: (id: string) => void;
    disabled?: boolean;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }
>(function PlayerPicker({ id, players, value, onChange, disabled, ...aria }, ref) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listId = `${id}-listbox`;
  const selected = players.find((p) => p.id === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? players.filter((p) =>
          [p.name, p.version, p.club ?? "", p.position ?? ""].some((s) => s.toLowerCase().includes(q)),
        )
      : players;
    return list.slice(0, 100);
  }, [players, query]);

  React.useEffect(() => setActive(0), [query]);

  const choose = (p: PickerPlayer) => {
    onChange(p.id);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30",
            !selected && "text-muted-foreground",
          )}
          {...aria}
        >
          <span className="truncate">{selected ? playerLabel(selected) : "Select a player"}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && filtered[active]) {
                e.preventDefault();
                choose(filtered[active]);
              }
            }}
            placeholder="Search name, version or club…"
            aria-label="Search players"
            aria-controls={listId}
            aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul id={listId} role="listbox" aria-label="Players" className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">No matching players.</li>}
          {filtered.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${p.id}`}
              role="option"
              aria-selected={p.id === value}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(p)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm",
                i === active && "bg-accent text-accent-foreground",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate">{playerLabel(p)}</span>
                {(p.position || p.club || p.rating) && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {[p.rating, p.position, p.club].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              {p.id === value && <Check className="size-4 shrink-0" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
});
