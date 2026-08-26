import { expect, test } from "@playwright/test";

const openStartScreen = async (page: import("@playwright/test").Page): Promise<void> => {
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
  await expect(scenarioSelect.locator("option")).toHaveCount(10);
};

test.describe("Multiverse History non-multiplayer feature parity", () => {
  test("edits local content, orders actions, diplomacy, timeline, map, library, and settings", async ({
    page,
  }, testInfo) => {
    await openStartScreen(page);

    await page.getByTestId("library-rename-input").fill("첫 캠페인");
    await page.getByTestId("library-rename").click();
    await expect(page.getByTestId("library-select")).toHaveValue("local-demo");
    await page.getByTestId("library-duplicate").click();
    await expect(page.getByTestId("library-select").locator("option")).toHaveCount(2);
    await page.getByTestId("library-delete").click();
    await expect(page.getByTestId("library-select").locator("option")).toHaveCount(1);
    await page.getByTestId("theme-select").selectOption("night");
    await page.getByTestId("captions-toggle").uncheck();

    await page.getByTestId("open-preset-editor").click();
    await page.getByTestId("new-blank-preset").click();
    await expect(page.getByTestId("preset-status")).toContainText("빈 프리셋");
    await page.getByTestId("preset-nations").fill("대한제국, 일본제국");
    await page.getByTestId("preset-regions").fill("한성, 간토");
    await page.getByTestId("preset-geography").fill("사용자 산맥");
    await page.getByTestId("preset-rules").fill("평화 협정은 세 턴 동안 유지");
    await page.getByTestId("preset-history").fill("새로운 분기");
    await page.getByTestId("preset-brainstormPrompt").fill("대체 역사 아이디어");
    await page.getByTestId("preset-polishPrompt").fill("문장을 다듬기");
    await page.getByTestId("publish-preset").click();
    await expect(page.getByTestId("preset-status")).toContainText("로컬 게시");
    await page.getByTestId("preset-editor").getByRole("button", { name: "닫기" }).click();

    const scenarioSelect = page.getByTestId("scenario-select");
    await scenarioSelect.selectOption("scn_ea1900");
    const nationSelect = page.getByTestId("nation-select");
    await expect(nationSelect.locator('option[value="nat_kor"]')).toHaveCount(1);
    await nationSelect.selectOption("nat_kor");
    await page.getByTestId("custom-polity-toggle").check();
    await page.getByTestId("custom-polity-name").fill("한성 연방");
    await page.getByTestId("difficulty-select").selectOption("hard");
    await page.getByTestId("model-select").selectOption("deterministic");
    await page.getByTestId("start-campaign").click();
    await expect(page.getByTestId("campaign-state")).toBeVisible();
    await expect(page.locator(".inspector_heading h2")).toHaveText("한성 연방");

    await page.getByTestId("brainstorm-order").click();
    await expect(page.getByTestId("order-input")).not.toHaveValue("");
    await page.getByTestId("add-order-action").click();
    await expect(page.getByTestId("order-action-list")).toBeVisible();
    await page.getByTestId("order-action-0").fill("철도망을 확장한다");
    await page.getByTestId("order-input").fill("일본에 통상 협정을 제안한다");
    await page.getByTestId("polish-order").click();
    await page.getByTestId("advance-turn").click();
    await expect(page.getByTestId("turn-value")).toHaveText("1");

    await page.getByTestId("diplomacy-tab").click();
    await page.getByTestId("diplomacy-chat-scope").selectOption("group");
    await page.getByTestId("diplomacy-chat-input").fill("평화와 통상을 논의하자");
    await page.getByTestId("send-diplomacy-chat").click();
    await expect(page.getByTestId("diplomacy-chat-log")).toContainText("평화와 통상을 논의하자");
    await page.getByTestId("diplomacy-clause").selectOption("threat");
    await page.getByTestId("propose-treaty").click();
    await expect(page.getByTestId("diplomacy-proposal-status")).toContainText("위협");
    await page.getByTestId("diplomacy-clause").selectOption("peace");
    await page.getByTestId("propose-treaty").click();
    await expect(page.getByTestId("diplomacy-proposal-status")).toContainText("평화");
    await page.getByTestId("diplomacy-clause").selectOption("ultimatum");
    await page.getByTestId("propose-treaty").click();
    await expect(page.getByTestId("diplomacy-proposal-status")).toContainText("최후통첩");
    await page.getByTestId("transfer-territory").click();
    await expect(page.getByTestId("diplomacy-proposal-status")).toContainText("이전했습니다");
    await page.getByTestId("advisor-question-mode").selectOption("custom");
    await page.getByTestId("advisor-custom-question").fill("지금 평화가 유리한가?");
    await page.getByTestId("advisor-assist").click();
    await expect(page.getByTestId("advisor-suggestion")).toContainText("지금 평화가 유리한가?");

    const chronicleTab = page.getByTestId("chronicle-tab");
    await chronicleTab.click();
    await expect(chronicleTab).toHaveAttribute("aria-selected", "true");
    await page.getByTestId("timeline-cadence").selectOption("year");
    await page.getByTestId("timeline-jump").click();
    await expect(page.getByTestId("timeline-intervention-result")).toContainText("1년");
    await page.getByTestId("timeline-save").click();
    await expect(page.getByTestId("timeline-save-status")).toContainText("상태를 저장했습니다");
    await page.getByTestId("activate-catalyst").click();
    await page.getByTestId("activate-storyline").click();
    await expect(page.getByTestId("active-storylines")).toContainText("산업화 촉매");
    await page.getByTestId("discard-queued-event-0").click();
    await page.getByTestId("delete-queued-event-0").click();

    for (const mode of ["political", "terrain", "diplomacy", "economy", "military"]) {
      await page.getByTestId(`map-mode-${mode}`).click();
      await expect(page.locator(".map_stage")).toHaveAttribute("data-map-mode", mode);
    }
    await page.getByTestId("globe-view-toggle").click();
    await expect(page.getByTestId("world-map")).toBeVisible();
    await expect(page.getByTestId("faction-overlay-panel")).toBeVisible();
    await page.getByTestId("faction-overlay-nat_kor").hover();
    await expect(page.getByTestId("faction-overlay-hover")).toContainText("한성 연방");
    await page.getByTestId("faction-overlay-nat_kor").click();
    await expect(page.getByTestId("map-nation-select")).toHaveValue("nat_kor");
    await page.getByTestId("world-map").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `.omo/evidence/G002-C002/${testInfo.project.name}-map-faction-overlay.png`,
    });
    await page.locator('[data-testid^="faction-overlay-map-"]').first().click({ force: true });
    await page.getByTestId("custom-geography-input").fill("신대륙 관문");
    await page.getByTestId("add-custom-geography").click();
    await expect(page.getByTestId("map-entities")).toContainText("신대륙 관문");
    await page.getByTestId("order-input").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `.omo/evidence/G002-C002/${testInfo.project.name}-workbench.png`,
    });

    await page.screenshot({
      path: `.omo/evidence/G002-C002/${testInfo.project.name}-feature-parity.png`,
    });
  });
});
