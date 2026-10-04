import { expect, test } from "@playwright/test";
import { addPlayer, pickPlayer, recordPrice, signUp, unique } from "./helpers";

test("a price alert fires once when a recorded price meets it", async ({ page }) => {
  await signUp(page);
  const player = unique("Alerted");
  await addPlayer(page, player);
  await recordPrice(page, player, "10000");

  await page.goto("/alerts", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New alert" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create a price alert" });
  await pickPlayer(page, player);
  await dialog.getByLabel("Target price").fill("9000");
  await dialog.getByRole("button", { name: "Create alert" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Not met")).toBeVisible();

  await recordPrice(page, player, "8500");
  await expect(page.getByText("Alert triggered")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Condition met")).toBeVisible();
  await expect(page.getByText(/at or below 9,000 \(observed 8,500\)/)).toBeVisible();
  await expect(page.getByText("1 unread", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Alerts 1 unread alerts/ })).toBeVisible();

  // Still below target: no second notification (edge-triggered)
  await recordPrice(page, player, "8400");
  await page.reload();
  await expect(page.getByText(/observed 8,400/)).toHaveCount(0);

  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText("All caught up")).toBeVisible();
});
