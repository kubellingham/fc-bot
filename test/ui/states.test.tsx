// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BriefingCard } from "@/components/features/briefing-card";
import { ConfirmAction } from "@/components/features/confirm-action";
import { HoldingsTable } from "@/components/features/holdings-table";
import { PriceAge } from "@/components/app/price-age";
import type { HoldingRow } from "@/lib/data/views";
import { renderWithProviders } from "../render";

const generateBriefing = vi.fn();
vi.mock("@/lib/actions/ai", () => ({ generateBriefing: (v: unknown) => generateBriefing(v) }));
vi.mock("@/lib/actions/trades", () => ({ createTrade: vi.fn(), updateTrade: vi.fn(), recordSale: vi.fn() }));
vi.mock("@/lib/actions/prices", () => ({ recordObservation: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const holding = (over: Partial<HoldingRow>): HoldingRow => ({
  playerId: "p1",
  label: "Alpha Striker",
  position: "ST",
  club: "Alpha FC",
  league: "League A",
  quantity: 2,
  averageCost: 10_000,
  totalCost: 20_000,
  latestPrice: 12_000,
  latestObservedAt: "2026-10-04T10:00:00Z",
  marketValue: 24_000,
  liquidationValue: 22_800,
  unrealizedProfit: 2_800,
  unrealizedRoiPercent: 14,
  breakEvenPrice: 10_527,
  openLots: [{ id: "l1", remainingQuantity: 2, unitCost: 10_000, acquiredAt: "2026-10-01T00:00:00Z" }],
  ...over,
});

describe("empty states", () => {
  it("guides a brand-new user to add a player first", () => {
    renderWithProviders(<HoldingsTable rows={[]} players={[]} taxRate={0.05} />);
    expect(screen.getByText("No holdings yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add your first player" })).toHaveAttribute("href", "/players");
  });

  it("explains when filters hide every row", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HoldingsTable rows={[holding({})]} players={[]} taxRate={0.05} />);
    await user.type(screen.getByRole("textbox", { name: "Search player" }), "zzz");
    expect(screen.getByText("No holdings match these filters.")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 holdings")).toBeInTheDocument();
  });
});

describe("HoldingsTable", () => {
  it("shows after-tax values, sign + colour for P&L, and flags unpriced holdings", () => {
    renderWithProviders(
      <HoldingsTable
        rows={[holding({}), holding({ playerId: "p2", label: "Beta Keeper", latestPrice: null, latestObservedAt: null, marketValue: null, liquidationValue: null, unrealizedProfit: null, unrealizedRoiPercent: null })]}
        players={[]}
        taxRate={0.05}
      />,
    );
    const table = screen.getByRole("table");
    const alpha = within(table).getByRole("row", { name: /Alpha Striker/ });
    expect(within(alpha).getByText("22,800")).toBeInTheDocument();
    const delta = within(alpha).getByText("+2,800").parentElement!;
    expect(delta).toHaveClass("tabular", "text-gain");
    expect(within(delta).getByText("gain")).toHaveClass("sr-only");
    expect(within(table).getByRole("row", { name: /Beta Keeper/ })).toHaveTextContent("No price");
  });

  it("sorts by unrealized P&L with unpriced rows last", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HoldingsTable
        rows={[
          holding({ playerId: "a", label: "Small Gain", unrealizedProfit: 100 }),
          holding({ playerId: "b", label: "Unpriced", unrealizedProfit: null }),
          holding({ playerId: "c", label: "Big Gain", unrealizedProfit: 9_000 }),
        ]}
        players={[]}
        taxRate={0.05}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Unrealized P&L/ }));
    const names = within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(names[0]).toContain("Big Gain");
    expect(names[2]).toContain("Unpriced");
    expect(screen.getByRole("columnheader", { name: /Unrealized P&L/ })).toHaveAttribute("aria-sort", "descending");
  });
});

describe("loading and error states", () => {
  it("shows a loading state while a briefing is generated, then the error", async () => {
    let resolve!: (v: unknown) => void;
    generateBriefing.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    renderWithProviders(<BriefingCard briefing={null} aiConfigured={false} />);
    await user.click(screen.getByRole("button", { name: "Generate" }));
    expect(await screen.findByRole("button", { name: "Analysing…" })).toBeDisabled();
    expect(screen.getByLabelText("Generating briefing")).toBeInTheDocument();
    resolve({ ok: false, error: "There are no trades, holdings or recorded prices yet." });
    expect(await screen.findByText(/no trades, holdings or recorded prices/)).toBeInTheDocument();
  });

  it("renders a saved briefing with source, confidence, evidence and limitations", () => {
    renderWithProviders(
      <BriefingCard
        aiConfigured
        briefing={{
          id: "b",
          source: "ai",
          model: "claude-opus-5-5",
          generatedAt: "2026-10-04T11:00:00Z",
          removedStatements: 0,
          briefing: {
            summary: "Steady week.",
            observations: [{ statement: "Alpha rose.", evidence: "10k → 12k", players: ["Alpha"] }],
            risks: [],
            opportunities: [],
            confidence: "low",
            dataLimitations: ["Few observations."],
          },
        }}
      />,
    );
    expect(screen.getByText("AI analysis")).toBeInTheDocument();
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByText("Why: 10k → 12k")).toBeInTheDocument();
    expect(screen.getByText("Few observations.")).toBeInTheDocument();
    expect(screen.getByText("1h ago")).toBeInTheDocument();
    expect(screen.getByText(/Not financial advice/)).toBeInTheDocument();
  });

  it("keeps a confirmation open and shows the server's error", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue({ ok: false, error: "This player has 2 recorded trades." });
    renderWithProviders(<ConfirmAction title="Delete?" description="Sure?" onConfirm={onConfirm} trigger={<button>Delete it</button>} />);
    await user.click(screen.getByRole("button", { name: "Delete it" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("This player has 2 recorded trades.")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("closes a confirmation after success", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ConfirmAction title="Delete?" description="Sure?" onConfirm={() => Promise.resolve({ ok: true, data: null })} trigger={<button>Delete it</button>} />,
    );
    await user.click(screen.getByRole("button", { name: "Delete it" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});

describe("PriceAge", () => {
  it("flags prices older than a day", () => {
    renderWithProviders(
      <>
        <PriceAge observedAt="2026-10-04T11:00:00Z" />
        <PriceAge observedAt="2026-10-01T12:00:00Z" />
        <PriceAge observedAt={null} />
      </>,
    );
    expect(screen.getByText("1h ago")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("3d ago")).toHaveClass("text-warning");
    expect(screen.getByText("(may be out of date)")).toBeInTheDocument();
    expect(screen.getByText("No price recorded")).toBeInTheDocument();
  });
});
