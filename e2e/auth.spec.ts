import { expect, test } from "@playwright/test";
import { PASSWORD, signIn, signUp, alertWith } from "./helpers";

test.describe("authentication", () => {
  test("protected pages redirect to sign-in and return afterwards", async ({ page }) => {
    const email = await signUp(page);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL((url) => url.pathname === "/");

    await page.goto("/portfolio", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login\?next=%2Fportfolio/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/portfolio");
  });

  test("rejects wrong credentials with a generic message", async ({ page }) => {
    await signIn(page, "nobody@example.test", "wrong-password");
    await expect(alertWith(page, "Incorrect email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("validates the sign-up form before submitting", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm password").fill("different");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("ignores open-redirect attempts after sign-in", async ({ page }) => {
    const email = await signUp(page);
    await page.context().clearCookies();
    await page.goto("/login?next=//evil.example/steal", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard");
    expect(new URL(page.url()).host).toBe(new URL(test.info().project.use.baseURL!).host);
  });

  test("sends security headers including a nonce-based CSP", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"];
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});
