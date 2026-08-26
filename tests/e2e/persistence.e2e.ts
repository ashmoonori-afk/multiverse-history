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

test.describe("Multiverse History persistence", () => {
  test("saves, reloads, exports, and imports the committed campaign", async ({
    page,
  }, testInfo) => {
    // Given
    await startKoreanCampaign(page);
    await page.getByTestId("order-input").fill("철도망을 확장하고 일본에 통상 협정을 제안한다");
    await page.getByTestId("advance-turn").click();
    await expect(page.getByTestId("turn-value")).toHaveText("1");

    // When
    await page.getByTestId("save-campaign").click();
    await expect(page.getByTestId("save-status")).toContainText("저장");
    const turnBeforeReload = await page.getByTestId("turn-value").textContent();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-campaign").click();
    const download = await downloadPromise;

    // Then
    await page.reload();
    await expect(page.getByTestId("turn-value")).toHaveText(turnBeforeReload ?? "");
    await page.getByTestId("new-campaign").click();
    await expect(page.getByTestId("import-campaign-input")).toBeVisible();
    const importedFile = await download.path();
    expect(importedFile).not.toBeNull();
    await page.getByTestId("import-campaign-input").setInputFiles(importedFile ?? "");
    await expect(page.getByTestId("turn-value")).toHaveText(turnBeforeReload ?? "");
    await expect(page.getByTestId("state-hash")).toHaveAttribute("title", /^[a-f0-9]{64}$/);
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-persistence.png`,
    });
  });
});
