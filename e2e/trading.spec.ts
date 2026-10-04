import { expect, test } from "@playwright/test";
import { addPlayer, kpi, recordPrice, recordPurchase, signUp, unique } from "./helpers";

test("purchase, price, partial FIFO sale and P&L after the 5% tax", async ({ page }) => {
  await signUp(page);

  // Starting balance 100,000
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.getByLabel("Starting coin balance").fill("100k");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  const player = unique("Striker");
  await addPlayer(page, player);

  // Two separate purchases: 1 @ 9,000 then 1 @ 11,000 → average cost 10,000
  await recordPurchase(page, player, "1", "9000");
  await recordPurchase(page, player, "1", "11k");

  await page.goto("/portfolio", { waitUntil: "networkidle" });
  await expect(kpi(page, "Available coins")).toContainText("80,000");
  await expect(kpi(page, "Invested")).toContainText("20,000");
  const row = page.getByRole("row", { name: new RegExp(player) });
  await expect(row).toContainText("10,000"); // average cost
  await expect(row).toContainText("2 buys");
  await expect(row).toContainText("No price");

  // Price observed at 12,000: 2 × 12,000 × 0.95 − 20,000 = +2,800 unrealized
  await recordPrice(page, player, "12,000");
  await expect(kpi(page, "Unrealized P&L")).toContainText("+2,800");
  await expect(row).toContainText("22,800 after tax");

  // Sell one at 12,000. FIFO takes the 9,000 copy: 11,400 − 9,000 = +2,400 realized
  await row.getByRole("button", { name: "Sell" }).click();
  const sale = page.getByRole("dialog", { name: "Record a sale" });
  await expect(sale).toContainText("oldest copies are sold first");
  await sale.getByLabel("Sale price (each)").fill("12000");
  await expect(sale).toContainText("+2,400");
  await sale.getByRole("button", { name: "Record sale" }).click();
  await expect(sale).toBeHidden();

  await expect(kpi(page, "Realized P&L")).toContainText("+2,400");
  await expect(kpi(page, "Available coins")).toContainText("91,400"); // 80,000 + 11,400
  await expect(kpi(page, "Invested")).toContainText("11,000");

  // Journal: the 9,000 purchase is closed with ROI 26.7%; the 11,000 one is open
  await page.goto("/trading", { waitUntil: "networkidle" });
  const closed = page.getByRole("row").filter({ hasText: player }).filter({ hasText: "Closed" });
  await expect(closed).toContainText("+2,400");
  await expect(closed).toContainText("+26.7%");
  await expect(page.getByRole("row").filter({ hasText: player }).filter({ hasText: "Open" })).toHaveCount(1);

  // Deleting the sale restores the holding
  await closed.getByRole("button", { name: "Show sales and notes" }).click();
  await page.getByRole("button", { name: "Delete sale" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Sale deleted.")).toBeVisible();
  await page.goto("/portfolio", { waitUntil: "networkidle" });
  await expect(kpi(page, "Invested")).toContainText("20,000");
});

test("purchase form rejects invalid input and keeps the dialog open", async ({ page }) => {
  await signUp(page);
  const player = unique("Keeper");
  await addPlayer(page, player);
  await page.getByRole("banner").getByRole("button", { name: "Record purchase" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a purchase" });
  await dialog.getByLabel("Quantity").fill("0");
  await dialog.getByLabel("Purchase price (each)").fill("lots");
  await dialog.getByRole("button", { name: "Record purchase" }).click();
  await expect(dialog.getByText("Invalid identifier.")).toBeVisible();
  await expect(dialog.getByText(/Quantity must be a whole number/)).toBeVisible();
  await expect(dialog.getByText(/Enter purchase price as a whole number/)).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("a player with trades cannot be deleted", async ({ page }) => {
  await signUp(page);
  const player = unique("Winger");
  await addPlayer(page, player);
  await recordPurchase(page, player, "1", "5000");
  await page.goto("/players", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: `Delete ${player}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("1 recorded trade");
});
