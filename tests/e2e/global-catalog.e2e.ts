import { expect, test } from "@playwright/test";

test.describe("Multiverse History global catalog", () => {
  test("lists diverse scenarios and starts a neutral country", async ({ page }, testInfo) => {
    await page.goto("/");
    const scenarioSelect = page.getByTestId("scenario-select");
    const nationSelect = page.getByTestId("nation-select");
    await page
      .locator('[data-testid="scenario-select"], [data-testid="campaign-state"]')
      .first()
      .waitFor({ state: "visible" });
    if (await page.getByTestId("campaign-state").isVisible()) {
      await page.getByTestId("new-campaign").click({ force: true });
      await expect(scenarioSelect).toBeVisible();
    }
    await expect(scenarioSelect.locator("option")).toHaveCount(10);
    await scenarioSelect.selectOption("scn_bronze_1200bc");
    await expect(nationSelect.locator("option")).toHaveCount(250);
    await nationSelect.selectOption("nat_bra");
    await page.getByTestId("start-campaign").click();
    await expect(page.getByTestId("campaign-state")).toBeVisible();
    await expect(page.locator(".inspector_heading h2")).toHaveText("브라질");
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-global-catalog.png`,
    });
  });
});
