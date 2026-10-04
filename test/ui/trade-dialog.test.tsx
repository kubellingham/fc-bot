// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TradeDialog } from "@/components/features/trade-dialog";
import { renderWithProviders } from "../render";

const createTrade = vi.fn();
// A plain async function (not a vi.fn returning a rejected promise) simulates a dropped
// connection: Vitest reports rejected vi.fn results even when the caller handles them.
let networkDown = false;
vi.mock("@/lib/actions/trades", () => ({
  createTrade: async (v: unknown) => {
    if (networkDown) throw new TypeError("Failed to fetch");
    return createTrade(v);
  },
  updateTrade: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const PLAYER_ID = "6f1d9a8e-2a4b-4c4e-9f00-1b2c3d4e5f60";
const players = [{ id: PLAYER_ID, name: "Test Striker", version: "Base", rating: 90, position: "ST", club: "FC Test" }];

async function openDialog() {
  const user = userEvent.setup();
  renderWithProviders(<TradeDialog players={players} taxRate={0.05} trigger={<button>Open</button>} />);
  await user.click(screen.getByRole("button", { name: "Open" }));
  return { user, dialog: await screen.findByRole("dialog") };
}

async function choosePlayer(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.click(within(dialog).getByRole("combobox", { name: "Player" }));
  await user.click(await screen.findByRole("option", { name: /Test Striker/ }));
}

describe("TradeDialog", () => {
  beforeEach(() => {
    createTrade.mockReset();
    networkDown = false;
  });

  it("shows validation errors and does not submit invalid input", async () => {
    const { user, dialog } = await openDialog();
    await user.clear(within(dialog).getByLabelText(/Quantity/));
    await user.type(within(dialog).getByLabelText(/Quantity/), "0");
    await user.type(within(dialog).getByLabelText(/Purchase price/), "lots");
    await user.click(within(dialog).getByRole("button", { name: "Record purchase" }));

    expect(await within(dialog).findByText("Invalid identifier.")).toBeInTheDocument();
    expect(within(dialog).getByText(/Quantity must be a whole number/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Enter purchase price as a whole number/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Quantity/)).toHaveAttribute("aria-invalid", "true");
    expect(createTrade).not.toHaveBeenCalled();
  });

  it("previews tax and profit for an already-sold trade using the finance module", async () => {
    const { user, dialog } = await openDialog();
    await user.type(within(dialog).getByLabelText(/Purchase price/), "10000");
    await user.click(within(dialog).getByRole("switch", { name: "Already sold" }));
    await user.type(within(dialog).getByLabelText(/Sale price/), "12k");
    expect(within(dialog).getByText("= 12,000")).toBeInTheDocument();
    expect(within(dialog).getByText("−600")).toBeInTheDocument();
    expect(within(dialog).getByText("11,400")).toBeInTheDocument();
    expect(within(dialog).getByText("+1,400")).toBeInTheDocument();
  });

  it("submits raw values and closes on success", async () => {
    createTrade.mockResolvedValue({ ok: true, data: { id: "x" }, message: "Trade recorded." });
    const { user, dialog } = await openDialog();
    await choosePlayer(user, dialog);
    await user.type(within(dialog).getByLabelText(/Purchase price/), "12.5k");
    await user.click(within(dialog).getByRole("button", { name: "Record purchase" }));
    await waitFor(() => expect(createTrade).toHaveBeenCalledTimes(1));
    expect(createTrade.mock.calls[0][0]).toMatchObject({ playerId: PLAYER_ID, quantity: "1", unitCost: "12.5k", sold: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows server errors on the right fields and keeps the dialog open", async () => {
    createTrade.mockResolvedValue({ ok: false, error: "Please correct the highlighted fields.", fieldErrors: { unitCost: "Too expensive." } });
    const { user, dialog } = await openDialog();
    await choosePlayer(user, dialog);
    await user.type(within(dialog).getByLabelText(/Purchase price/), "100");
    await user.click(within(dialog).getByRole("button", { name: "Record purchase" }));
    expect(await within(dialog).findByText("Too expensive.")).toBeInTheDocument();
    expect(within(dialog).getByText("Please correct the highlighted fields.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("reports network failures without crashing", async () => {
    networkDown = true;
    const { user, dialog } = await openDialog();
    await choosePlayer(user, dialog);
    await user.type(within(dialog).getByLabelText(/Purchase price/), "100");
    await user.click(within(dialog).getByRole("button", { name: "Record purchase" }));
    expect(await within(dialog).findByText(/couldn't reach the server/)).toBeInTheDocument();
  });
});
