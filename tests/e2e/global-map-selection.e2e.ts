import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const startKoreanCampaign = async (page: Page): Promise<void> => {
  await page.goto("/");
  const scenarioSelect = page.getByTestId("scenario-select");
  await page
    .locator('[data-testid="scenario-select"], [data-testid="campaign-state"]')
    .first()
    .waitFor({ state: "visible" });
  if (await page.getByTestId("campaign-state").isVisible()) {
    await page.getByTestId("new-campaign").click({ force: true });
    await expect(scenarioSelect).toBeVisible();
  }
  await scenarioSelect.selectOption("scn_ea1900");
  await page.getByTestId("nation-select").selectOption("nat_kor");
  await page.getByTestId("start-campaign").click();
  await expect(page.getByTestId("campaign-state")).toBeVisible();
};

test.describe("Multiverse History global map selection", () => {
  test("selects Russia from the map and opens its nation inspector", async ({ page }, testInfo) => {
    // Given
    await startKoreanCampaign(page);

    // When
    await page.getByTestId("map-nation-select").selectOption("nat_rus");

    // Then
    await expect(page.getByTestId("selected-nation-panel")).toHaveAttribute(
      "data-nation-id",
      "nat_rus",
    );
    await expect(page.getByTestId("selected-nation-panel")).toContainText("러시아제국");
    await expect(page.getByTestId("map-nation-select")).toHaveValue("nat_rus");
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-global-map-selection.png`,
    });
  });
});
