import { expect, test } from "@playwright/test";

import { openAdvisor, openStartScreen, selectStartNation } from "./helpers/open-historia";

test.describe("Multiverse History global catalog", () => {
  test("lists diverse scenarios and starts a neutral country", async ({ page }, testInfo) => {
    await openStartScreen(page);
    const scenarioSelect = page.getByTestId("scenario-select");
    const nationSelect = page.getByTestId("nation-select");
    await expect(scenarioSelect.locator("option")).toHaveCount(10);
    await scenarioSelect.selectOption("scn_bronze_1200bc");
    await expect(nationSelect).toHaveAttribute("data-option-count", "250");
    await selectStartNation(page, "nat_bra");
    await page.getByTestId("start-campaign").click();
    await expect(page.getByTestId("campaign-state")).toBeVisible();
    await openAdvisor(page);
    await expect(page.getByTestId("selected-nation-panel")).toContainText("브라질");
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-global-catalog.png`,
    });
  });
});
