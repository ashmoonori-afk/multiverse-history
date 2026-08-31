import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { selectStartNation } from "./helpers/open-historia";

const startKoreanCampaign = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page
    .locator('[data-testid="scenario-select"], [data-testid="campaign-state"]')
    .first()
    .waitFor({ state: "visible" });
  if (await page.getByTestId("campaign-state").isVisible()) {
    const directExit = page.getByTestId("new-campaign");
    if ((await directExit.count()) > 0 && (await directExit.isVisible())) {
      await directExit.click({ force: true });
    } else {
      await page.getByTestId("oh-settings").click();
      await page.getByRole("button", { name: "새 캠페인", exact: true }).click();
    }
  }
  await expect(page.getByTestId("catalog-status")).toHaveAttribute("data-loading", "false");
  await page.getByTestId("scenario-select").selectOption("scn_ea1900");
  await selectStartNation(page, "nat_kor");
  await page.getByTestId("start-campaign").click();
  await expect(page.getByTestId("campaign-state")).toBeVisible();
};

const edgeDistance = async (
  page: Page,
  testId: string,
): Promise<{ top: number; left: number; right: number; bottom: number; position: string }> =>
  page.getByTestId(testId).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      top: box.top,
      left: box.left,
      right: window.innerWidth - box.right,
      bottom: window.innerHeight - box.bottom,
      position: getComputedStyle(element).position,
    };
  });

test("reproduces the Open Historia fixed HUD islands", async ({ page }) => {
  await startKoreanCampaign(page);

  const obsoleteSelectors = [
    ".nation_rail",
    ".game_topbar",
    ".strategy_navigation",
    ".command_drawer",
    ".mobile_navigation",
    ".map_header",
    ".map_selection_row",
    ".map_stage_chrome",
  ].join(",");
  await expect(page.locator(obsoleteSelectors)).toHaveCount(0);

  const settings = await edgeDistance(page, "oh-settings");
  const date = await edgeDistance(page, "oh-date");
  const chat = await edgeDistance(page, "oh-chat");
  const actions = await edgeDistance(page, "oh-actions");
  const search = await edgeDistance(page, "oh-search");
  const flag = await edgeDistance(page, "oh-player-flag");

  for (const island of [settings, date, chat, actions, search, flag]) {
    expect(island.position).toBe("fixed");
  }
  expect(settings.top).toBeCloseTo(8, 0);
  expect(settings.left).toBeCloseTo(8, 0);
  expect(date.top).toBeCloseTo(8, 0);
  expect(date.right).toBeCloseTo(8, 0);
  expect(chat.left).toBeCloseTo(8, 0);
  expect(chat.bottom).toBeCloseTo(8, 0);
  expect(actions.left).toBeCloseTo(80, 0);
  expect(actions.bottom).toBeCloseTo(8, 0);
  expect(search.bottom).toBeCloseTo(16, 0);
  expect(flag.right).toBeCloseTo(8, 0);
  expect(flag.bottom).toBeCloseTo(76, 0);
  if (test.info().project.name === "mobile") {
    await expect(page.getByTestId("oh-session")).toHaveCount(0);
    await expect(page.getByTestId("oh-exit")).toHaveCount(0);
  } else {
    const session = await edgeDistance(page, "oh-session");
    const exit = await edgeDistance(page, "oh-exit");
    expect(session.position).toBe("fixed");
    expect(exit.position).toBe("fixed");
    expect(session.top).toBeCloseTo(8, 0);
    expect(session.left).toBeCloseTo(80, 0);
    expect(exit.top).toBeCloseTo(8, 0);
  }
  await page.screenshot({
    path: `.omo/evidence/open-historia-clone/actual/${test.info().project.name}-hud.png`,
  });
});

test("keeps the advisor control reachable while the drawer is open", async ({ page }) => {
  await startKoreanCampaign(page);
  const advisor = page.getByTestId("oh-advisor");

  await advisor.click();
  await expect(page.getByRole("complementary", { name: "전략 자문" })).toBeVisible();
  await expect(advisor).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("close-advisor")).toBeVisible();

  await page.getByTestId("close-advisor").click();
  await expect(page.getByRole("complementary", { name: "전략 자문" })).toHaveCount(0);
});
