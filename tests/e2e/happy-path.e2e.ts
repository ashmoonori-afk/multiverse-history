import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const orderText = "철도망을 확장하고 일본에 통상 협정을 제안한다";

const startKoreanCampaign = async (page: Page): Promise<void> => {
  await page.goto("/");
  const scenarioSelect = page.getByTestId("scenario-select");
  const campaignState = page.getByTestId("campaign-state");
  await page
    .locator('[data-testid="scenario-select"], [data-testid="campaign-state"]')
    .first()
    .waitFor({ state: "visible" });
  if (await page.getByTestId("campaign-state").isVisible()) {
    await page.getByTestId("new-campaign").click({ force: true });
    await expect(scenarioSelect).toBeVisible();
  }
  await expect(page.getByTestId("campaign-shell")).toBeVisible();
  await expect(campaignState).not.toBeVisible();
  await scenarioSelect.selectOption("scn_ea1900");
  await expect(page.getByTestId("scenario-summary")).toContainText("1900 동아시아");
  await page.getByTestId("nation-select").selectOption("nat_kor");
  await expect(page.getByTestId("nation-summary")).toContainText("대한제국");
  await page.getByTestId("start-campaign").click();
  await expect(page.getByTestId("campaign-state")).toBeVisible();
};

const playRailAndTradeTurn = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("world-map")).toBeVisible();
  await expect(page.getByTestId("map-alternative-list")).toBeVisible();
  await expect(page.getByRole("button", { name: "정치 지도 모드" })).toBeVisible();
  await expect(page.getByRole("button", { name: "경제 지도 모드" })).toBeVisible();
  await expect(page.getByTestId("turn-value")).toHaveText("0");
  await expect(page.getByTestId("date-value")).toHaveText("1900년 1분기");
  await expect(page.getByTestId("treasury-value")).toHaveText("240");
  await expect(page.getByTestId("population-value")).toHaveText("17,082,000");
  await expect(page.getByTestId("infrastructure-value")).toHaveText("2,400bp");
  await expect(page.getByTestId("relations-list")).not.toBeEmpty();

  await page.getByTestId("order-input").fill(orderText);
  await page.getByTestId("advance-turn").click();

  await expect(page.getByTestId("turn-value")).toHaveText("1");
  await expect(page.getByTestId("date-value")).toHaveText("1900년 2분기");
  await expect(page.getByTestId("treasury-value")).toHaveText("215");
  await expect(page.getByTestId("infrastructure-value")).toHaveText("2,650bp");
  await expect(page.getByTestId("treaty-list")).toContainText("일본");
  await expect(page.getByTestId("npc-actions")).not.toBeEmpty();
  await expect(page.getByTestId("chronicle-list")).toContainText(
    "대한제국은 철도망에 25 크레딧을 투자해 기반시설을 250bp 확충했다.",
  );
};

test.describe("Multiverse History browser happy path", () => {
  test("starts 1900 East Asia as Korea and commits rail/trade turn", async ({ page }, testInfo) => {
    await startKoreanCampaign(page);
    await playRailAndTradeTurn(page);
    await page
      .getByTestId("campaign-shell")
      .evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-happy-path.png`,
    });
  });

  test("keeps the campaign shell usable at its configured responsive viewport", async ({
    page,
  }, testInfo) => {
    await startKoreanCampaign(page);
    await playRailAndTradeTurn(page);

    const viewportWidth = page.viewportSize()?.width ?? 390;
    expect(viewportWidth).toBe(testInfo.project.name === "mobile" ? 390 : 1440);
    const bodyScrollWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth);
    if (testInfo.project.name === "mobile") {
      await expect(page.getByTestId("mobile-navigation")).toBeVisible();
      await expect(page.getByTestId("relations-list")).toBeVisible();
      await page.getByTestId("mobile-navigation").scrollIntoViewIfNeeded();
    } else {
      await page.getByTestId("npc-actions").scrollIntoViewIfNeeded();
    }
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-responsive.png`,
    });
  });
});
