import { expect, test } from "@playwright/test";
import { addPlayer, signUp, unique } from "./helpers";

test("one user cannot open another user's player page", async ({ browser }) => {
  const alice = await browser.newContext();
  const alicePage = await alice.newPage();
  await signUp(alicePage);
  const name = unique("Private");
  await addPlayer(alicePage, name);
  await alicePage.getByRole("link", { name, exact: true }).click();
  await alicePage.waitForURL(/\/players\/[0-9a-f-]{36}$/);
  const url = alicePage.url();
  await expect(alicePage.getByRole("heading", { name })).toBeVisible();

  const bob = await browser.newContext();
  const bobPage = await bob.newPage();
  await signUp(bobPage);
  await bobPage.goto(url);
  await expect(bobPage.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await bobPage.goto("/players");
  await expect(bobPage.getByText(name)).toHaveCount(0);

  await alice.close();
  await bob.close();
});
