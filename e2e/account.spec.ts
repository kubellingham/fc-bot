import { expect, test } from "@playwright/test";
import { PASSWORD, addPlayer, signIn, signUp, unique, alertWith } from "./helpers";

test("deleting the account removes it and signs the user out", async ({ page }) => {
  const email = await signUp(page);
  await addPlayer(page, unique("Doomed"));
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete your account permanently?" });
  await expect(dialog.getByRole("button", { name: "Delete everything" })).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog.getByRole("button", { name: "Delete everything" }).click();
  await page.waitForURL(/\/\?deleted=1/);
  await expect(page.getByText("Your account and all of its data have been deleted.")).toBeVisible();

  await signIn(page, email, PASSWORD);
  await expect(alertWith(page, "Incorrect email or password.")).toBeVisible();
});
