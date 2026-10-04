import { expect, test } from "@playwright/test";
import { signUp, unique, alertWith } from "./helpers";

test("CSV import shows a validated preview, imports only valid rows and never duplicates", async ({ page }) => {
  await signUp(page);
  const a = unique("Imported A");
  const b = unique("Imported B");
  const csv = [
    "name,version,rating,position,club",
    `${a},TOTW,90,ST,Some Club`,
    `${b},,85,CB,`,
    `,Base,80,GK,Missing name`,
    `${a},totw,90,ST,Duplicate within file`,
  ].join("\n");

  await page.goto("/data", { waitUntil: "networkidle" });
  await page.locator("#import-file").setInputFiles({ name: "players.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("players.csv · 4 rows")).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("2 ready")).toBeVisible();
  await expect(page.getByText("1 invalid")).toBeVisible();
  await expect(page.getByText("1 duplicates skipped")).toBeVisible();
  await expect(page.getByText("name is required")).toBeVisible();
  await expect(page.getByText("Nothing has been saved yet.")).toBeVisible();

  await page.getByRole("button", { name: "Import 2 rows" }).click();
  await expect(page.getByText("Import complete")).toBeVisible();
  await expect(page.getByText("2 imported · 2 skipped")).toBeVisible();

  // Re-importing the same file adds nothing and overwrites nothing.
  await page.getByRole("button", { name: "Import another file" }).click();
  await page.locator("#import-file").setInputFiles({ name: "players.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("0 ready")).toBeVisible();
  await expect(page.getByRole("button", { name: /Import 0 rows/ })).toBeDisabled();

  // Export contains the imported players with formula-safe CSV.
  const res = await page.request.get("/api/export/players");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("attachment");
  const body = await res.text();
  expect(body).toContain("name,version,rating,position,club,league,nation,rarity");
  expect(body).toContain(`${a},TOTW,90,ST,Some Club`);
});

test("rejects a file with missing required columns", async ({ page }) => {
  await signUp(page);
  await page.goto("/data", { waitUntil: "networkidle" });
  await page.getByLabel("What are you importing?").click();
  await page.getByRole("option", { name: "Price observations" }).click();
  await page.locator("#import-file").setInputFiles({ name: "obs.csv", mimeType: "text/csv", buffer: Buffer.from("player,price\nX,100\n") });
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(alertWith(page, 'Missing required column "observed_at".')).toBeVisible();
});

test("exports require authentication", async ({ request }) => {
  const res = await request.get("/api/export/all", { maxRedirects: 0 });
  expect(res.status()).toBe(401);
});
