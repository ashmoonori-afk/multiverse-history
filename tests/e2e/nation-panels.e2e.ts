import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const startKoreanCampaign = async (page: Page): Promise<void> => {
  await page.goto("/");
  const scenarioSelect = page.getByTestId("scenario-select");
  await page
    .locator('[data-testid="scenario-select"], [data-testid="campaign-state"]')
    .first()
    .waitFor({ state: "visible" });
  if (!(await scenarioSelect.isVisible())) {
    await page.getByTestId("new-campaign").click();
    await expect(scenarioSelect).toBeVisible();
  }
  await page.getByTestId("nation-select").selectOption("nat_kor");
  await page.getByTestId("start-campaign").click();
  await expect(page.getByTestId("campaign-state")).toBeVisible();
};

test.describe("Multiverse History nation panels", () => {
  test("selects Japan and exposes its owned regions and Korea relation", async ({
    page,
  }, testInfo) => {
    // Given
    await startKoreanCampaign(page);
    await page.getByTestId("nation-tab").click();

    // When
    await page.getByTestId("nation-option-nat_jpn").click();

    // Then
    await expect(page.getByTestId("selected-nation-panel")).toHaveAttribute(
      "data-nation-id",
      "nat_jpn",
    );
    await expect(page.getByTestId("selected-nation-panel")).toContainText("일본제국");
    await expect(page.getByTestId("selected-nation-owned")).toHaveText("7");
    await expect(page.getByTestId("selected-nation-relation")).toHaveText("-500");
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-nation-panel.png`,
    });
  });
});
