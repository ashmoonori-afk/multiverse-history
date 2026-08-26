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

test.describe("Multiverse History diplomacy chat", () => {
  test("sends a nation message and requests advisor assistance", async ({ page }, testInfo) => {
    // Given
    await startKoreanCampaign(page);
    await page.getByTestId("diplomacy-tab").click();
    await expect(page.getByTestId("diplomacy-tab")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("외교 개요")).toBeVisible();

    // When
    await page.getByTestId("diplomacy-chat-target").selectOption("nat_jpn");
    await page.getByTestId("diplomacy-chat-input").fill("통상 협정을 논의하고 싶습니다.");
    await page.getByTestId("send-diplomacy-chat").click();
    await page.getByTestId("advisor-assist").click();

    // Then
    await expect(page.getByTestId("diplomacy-chat-log")).toContainText("통상 협정");
    await expect(page.getByTestId("diplomacy-chat-log")).toContainText("일본제국");
    await expect(page.getByTestId("advisor-suggestion")).toContainText("일본제국");
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-diplomacy-chat.png`,
    });
  });
});
