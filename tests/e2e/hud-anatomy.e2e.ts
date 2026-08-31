import { expect, test } from "@playwright/test";

import { openAdvisor, openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

test.describe("Open Historia HUD anatomy", () => {
  test("presents a full MapLibre world with fixed HUD islands", async ({ page }, testInfo) => {
    await startKoreanCampaign(page);

    await expect(page.getByTestId("open-historia-world")).toBeVisible();
    await expect(page.getByTestId("oh-settings")).toBeVisible();
    await expect(page.getByTestId("oh-date")).toBeVisible();
    await expect(page.getByTestId("oh-chat")).toBeVisible();
    await expect(page.getByTestId("oh-actions")).toBeVisible();
    await expect(page.getByTestId("oh-search")).toBeVisible();
    await expect(page.getByTestId("oh-player-flag")).toBeVisible();
    await expect(page.getByTestId("oh-advisor")).toBeVisible();
    await expect(
      page.locator(
        ".nation_rail, .game_topbar, .strategy_navigation, .command_drawer, .mobile_navigation",
      ),
    ).toHaveCount(0);

    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);
    await page.screenshot({
      path: `.omo/evidence/ui-overhaul/${testInfo.project.name}/open-historia-final.png`,
    });
  });

  test("keeps settings, chat, actions, search, and advisor operational", async ({ page }) => {
    await startKoreanCampaign(page);
    await openHudPanel(page, "oh-settings", "설정");
    await page.getByTestId("oh-settings").click();
    await openHudPanel(page, "oh-chat", "외교 채팅");
    await page.getByTestId("oh-chat").click();
    await openHudPanel(page, "oh-actions", "행동과 명령");
    await page.getByTestId("oh-actions").click();
    await openHudPanel(page, "oh-search", "국가 검색");
    await page.getByTestId("oh-search").click();
    await openAdvisor(page);
    await page.getByTestId("close-advisor").click();

    await expect(page.getByRole("complementary", { name: "전략 자문" })).toHaveCount(0);
    await expect(page.getByTestId("campaign-state")).toBeVisible();
  });
});
