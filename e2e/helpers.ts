import { expect, type Page } from "@playwright/test";

let counter = 0;
export const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const PASSWORD = "e2e-password-123";

/** Signs up a brand-new user through the UI (local stack auto-confirms emails). */
export async function signUp(page: Page): Promise<string> {
  const email = `${unique("e2e")}@example.test`;
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
  return email;
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function addPlayer(page: Page, name: string, extra: { position?: string; club?: string } = {}) {
  await page.goto("/players", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add player" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add player" });
  await dialog.getByLabel("Name").fill(name);
  if (extra.club) await dialog.getByLabel("Club").fill(extra.club);
  await dialog.getByRole("button", { name: "Add player" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
}

export async function pickPlayer(page: Page, name: string) {
  // Radix popovers also have role="dialog"; the form dialog is the one holding the combobox.
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("combobox", { name: "Player" }) });
  await dialog.getByRole("combobox", { name: "Player" }).click();
  await page.locator('[data-slot="popover-content"]').getByRole("textbox", { name: "Search players" }).fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
}

/** Opens the global "Record purchase" dialog and saves a purchase. */
export async function recordPurchase(page: Page, player: string, qty: string, price: string) {
  await page.getByRole("banner").getByRole("button", { name: "Record purchase" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a purchase" });
  await pickPlayer(page, player);
  await dialog.getByLabel("Quantity").fill(qty);
  await dialog.getByLabel("Purchase price (each)").fill(price);
  await dialog.getByRole("button", { name: "Record purchase" }).click();
  await expect(dialog).toBeHidden();
}

export async function recordPrice(page: Page, player: string, price: string) {
  await page.getByRole("banner").getByRole("button", { name: "Record price" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a price" });
  await pickPlayer(page, player);
  await dialog.getByRole("textbox", { name: "Price", exact: true }).fill(price);
  await dialog.getByRole("button", { name: "Record price" }).click();
  await expect(dialog).toBeHidden();
}

export function kpi(page: Page, label: string) {
  return page.locator('[data-slot="card"]', { has: page.getByText(label, { exact: true }) }).first();
}

/** Next.js also renders an empty role="alert" route announcer, so match alerts by text. */
export function alertWith(page: Page, text: string | RegExp) {
  return page.getByRole("alert").filter({ hasText: text });
}
