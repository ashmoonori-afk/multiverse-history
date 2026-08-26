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
  await scenarioSelect.selectOption("scn_ea1900");
  await page.getByTestId("nation-select").selectOption("nat_kor");
  await page.getByTestId("start-campaign").click();
  await expect(page.getByTestId("campaign-state")).toBeVisible();
};

test.describe("Multiverse History timeline intervention", () => {
  test("queues an intervention against a committed event", async ({ page }, testInfo) => {
    // Given
    await startKoreanCampaign(page);
    await page.getByTestId("order-input").fill("철도망을 확장하고 일본에 통상 협정을 제안한다");
    await page.getByTestId("advance-turn").click();
    await expect(page.getByTestId("chronicle-list")).not.toBeEmpty();
    await page.getByTestId("chronicle-tab").click();

    // When
    await page.getByTestId("timeline-event-0").click();
    await page.getByTestId("timeline-intervention-input").fill("의회가 예산 집행을 재검토한다.");
    await page.getByTestId("intervene-timeline").click();

    // Then
    await expect(page.getByTestId("timeline-intervention-result")).toContainText(
      "다음 확정 대기열",
    );
    await expect(page.getByTestId("timeline-intervention-result")).toContainText("예산 집행");
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-timeline-intervention.png`,
    });
  });
});
