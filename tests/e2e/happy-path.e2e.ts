import { expect, test } from "@playwright/test";

import { openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

test.describe("Open Historia browser happy path", () => {
  test("starts East Asia as Korea and commits a rail/trade turn", async ({ page }) => {
    await startKoreanCampaign(page);
    await openHudPanel(page, "oh-actions", "행동과 명령");

    await page.getByTestId("order-input").fill("철도망을 확장하고 일본과 통상한다");
    await page.getByTestId("advance-turn").click();
    await expect(page.getByTestId("resolution-summary")).toContainText("최근 확정 결과");
    await expect(page.getByTestId("campaign-state")).toBeVisible();
  });

  test("keeps the fixed map shell usable at its configured viewport", async ({
    page,
  }, testInfo) => {
    await startKoreanCampaign(page);
    const viewport = page.viewportSize();
    if (viewport === null) {
      throw new Error("Playwright viewport must be configured");
    }

    const mapBox = await page.getByTestId("open-historia-world").boundingBox();
    if (mapBox === null) {
      throw new Error("MapLibre viewport must be laid out");
    }
    expect(Math.abs(mapBox.width - viewport.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(mapBox.height - viewport.height)).toBeLessThanOrEqual(1);
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);

    await page.screenshot({
      path: `.omo/evidence/happy-path/open-historia-${testInfo.project.name}.png`,
    });
  });
});
