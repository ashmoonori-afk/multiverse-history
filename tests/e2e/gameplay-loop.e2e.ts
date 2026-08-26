import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const orderText = "철도망을 확장하고 일본에 통상 협정을 제안한다";
const chatText = "일본과 지금 협상할 수 있는 선택지를 요약해줘";

const startKoreanCampaign = async (page: Page): Promise<void> => {
  await page.goto("/", { waitUntil: "commit" });
  const scenarioSelect = page.getByTestId("scenario-select");
  await expect(page.getByTestId("campaign-shell")).toHaveAttribute("data-bootstrap-ready", "true");
  await page
    .locator('[data-testid="scenario-select"], [data-testid="campaign-state"]')
    .first()
    .waitFor({ state: "visible" });
  if (await page.getByTestId("campaign-state").isVisible()) {
    await page.getByTestId("new-campaign").click({ force: true });
    await expect(scenarioSelect).toBeVisible();
  }
  await expect(page.getByTestId("catalog-status")).toHaveAttribute("data-loading", "false");
  await scenarioSelect.selectOption("scn_ea1900");
  await page.getByTestId("nation-select").selectOption("nat_kor");
  await page.getByTestId("start-campaign").click();
  await expect(page.getByTestId("campaign-state")).toBeVisible();
};

test.describe("Multiverse History visible gameplay loop", () => {
  test("resolves an order into timestamped deltas and world impact", async ({ page }, testInfo) => {
    await startKoreanCampaign(page);

    await page.getByTestId("order-input").fill(orderText);
    await page.getByTestId("advance-turn").click();

    await expect(page.getByTestId("resolution-feed")).toBeVisible();
    await expect(page.getByTestId("resolution-entry")).toContainText("턴 1");
    await expect(page.getByTestId("resolution-timestamp")).toContainText("1900");
    await expect(page.getByTestId("resolution-delta-treasury")).toContainText(/국고.*\d+.*→.*\d+/);
    await expect(page.getByTestId("resolution-delta-economy")).toContainText(/경제.*\d+.*→.*\d+/);
    await expect(page.getByTestId("resolution-delta-relation")).toContainText(/관계.*\d+.*→.*\d+/);
    await expect(page.getByTestId("resolution-delta-treaty")).toContainText("통상");
    await expect(page.getByTestId("resolution-world-impact")).toContainText("일본제국");
    await expect(page.getByTestId("resolution-summary")).toContainText("240 → 215");
    await expect(page.getByTestId("resolution-summary")).toContainText("2,400 → 2,650");
    await expect(page.getByTestId("resolution-summary")).toContainText("-500 → -450");
    await expect(page.getByTestId("changed-region-marker")).toBeVisible();
    await page.screenshot({
      path: `.omo/evidence/gameplay/order-outcome-${testInfo.project.name}.png`,
    });
  });

  test("opens reachable chat and keeps the campaign usable", async ({ page }, testInfo) => {
    await startKoreanCampaign(page);

    await page.getByTestId("open-chat").click();
    await expect(page.getByTestId("chat-drawer")).toBeVisible();
    await page.getByTestId("chat-input").fill(chatText);
    await page.getByTestId("send-chat").click();

    await expect(page.getByTestId("chat-history")).toContainText(chatText);
    await expect(page.getByTestId("chat-history")).toContainText("일본제국");
    await expect(page.getByTestId("chat-reply")).toBeVisible();
    await expect(page.getByTestId("campaign-state")).toBeVisible();
    await expect(page.getByTestId("order-input")).toBeVisible();
    await page.screenshot({
      path: `.omo/evidence/gameplay/chat-${testInfo.project.name}.png`,
    });
  });

  test("supports bounded map navigation and preserves faction overlays", async ({
    page,
  }, testInfo) => {
    await startKoreanCampaign(page);

    const viewport = page.getByTestId("map-viewport");
    await expect(viewport).toBeVisible();
    const initialTransform = await viewport.getAttribute("data-map-transform");

    await page.getByTestId("map-zoom-in").click();
    await expect(viewport).not.toHaveAttribute("data-map-transform", initialTransform ?? "");
    await page.getByTestId("map-zoom-out").click();
    await page.getByTestId("map-reset").click();
    await expect(viewport).toHaveAttribute(
      "data-map-transform",
      "scale=1;translateX=0;translateY=0",
    );

    await viewport.hover();
    await page.mouse.wheel(0, -500);
    await expect(viewport).not.toHaveAttribute(
      "data-map-transform",
      "scale=1;translateX=0;translateY=0",
    );
    await page.mouse.move(420, 360);
    await page.mouse.down();
    await page.mouse.move(500, 390);
    await page.mouse.up();
    await expect(viewport).not.toHaveAttribute(
      "data-map-transform",
      "scale=1;translateX=0;translateY=0",
    );

    await page.getByTestId("map-focus-capital").click();
    await expect(viewport).toHaveAttribute("data-map-focus", "nat_kor");
    await page.getByTestId("faction-overlay-nat_kor").focus();
    await expect(page.getByTestId("faction-overlay-nat_kor")).toBeFocused();
    await page.screenshot({
      path: `.omo/evidence/gameplay/map-controls-${testInfo.project.name}.png`,
    });
  });
});
