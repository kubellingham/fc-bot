import { expect, test } from "@playwright/test";
import { addPlayer, recordPurchase, signUp, unique } from "./helpers";

test("mobile layout: bottom navigation and no horizontal scrolling", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await signUp(page);
  const nav = page.getByRole("navigation", { name: "Quick navigation" });
  await expect(nav).toBeVisible();
  for (const label of ["Dashboard", "Portfolio", "Watchlist", "Alerts", "More"]) {
    await expect(nav.getByText(label, { exact: true })).toBeVisible();
  }

  const player = unique("Mobile");
  await addPlayer(page, player);
  await recordPurchase(page, player, "3", "2500");

  for (const path of ["/dashboard", "/portfolio", "/trading", "/watchlist", "/players", "/analytics", "/settings"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} should not scroll horizontally`).toBeLessThanOrEqual(0);
  }

  await nav.getByText("More", { exact: true }).click();
  await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Analytics" }).click();
  await page.waitForURL("**/analytics");
});
