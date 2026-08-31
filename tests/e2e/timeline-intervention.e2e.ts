import { expect, test } from "@playwright/test";

import { openAdvisor, openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

test.describe("Multiverse History timeline intervention", () => {
  test("queues an intervention against a committed event", async ({ page }, testInfo) => {
    // Given
    await startKoreanCampaign(page);
    await openHudPanel(page, "oh-actions", "행동과 명령");
    await page.getByTestId("order-input").fill("철도망을 확장하고 일본에 통상 협정을 제안한다");
    await page.getByTestId("advance-turn").click();
    await expect(page.getByTestId("resolution-summary")).toBeVisible();
    await openAdvisor(page);
    const advisor = page.getByRole("complementary", { name: "전략 자문" });
    const timelineTab = advisor.getByRole("button", { name: "기록", exact: true });
    await timelineTab.click();
    await expect(timelineTab).toHaveAttribute("aria-current", "page");

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
