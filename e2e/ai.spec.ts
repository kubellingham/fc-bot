import { expect, test } from "@playwright/test";
import { addPlayer, recordPrice, signUp, unique, alertWith } from "./helpers";

// The test environment has no ANTHROPIC_API_KEY: the analyst must degrade gracefully.
test.skip(Boolean(process.env.ANTHROPIC_API_KEY), "runs only without an AI provider configured");

test("without an AI provider, briefings fall back to an automated summary", async ({ page }) => {
  await signUp(page);
  await page.goto("/ai-analyst", { waitUntil: "networkidle" });
  await expect(page.getByText("AI provider not configured")).toBeVisible();
  await expect(page.getByText("Questions need an AI provider")).toBeVisible();
  await expect(page.getByText(/nothing to analyse/)).toBeVisible();

  // Not enough data: generating is refused with an explanation, not a fabricated briefing.
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(alertWith(page, "nothing to analyse")).toBeVisible();

  const player = unique("Analysed");
  await addPlayer(page, player);
  await recordPrice(page, player, "10000");
  await recordPrice(page, player, "11000");
  await page.goto("/ai-analyst", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Automated summary", { exact: true })).toBeVisible();
  await expect(page.getByText(/Portfolio value is/)).toBeVisible();
  await expect(page.getByText(/no AI model was used/)).toBeVisible();
});
