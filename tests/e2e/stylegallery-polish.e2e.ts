import { expect, test } from "@playwright/test";

import { openStartScreen, startKoreanCampaign } from "./helpers/open-historia";

test("filters the global nation catalog through a searchable dropdown", async ({ page }) => {
  await openStartScreen(page);

  const search = page.getByRole("combobox", { name: "플레이 국가 검색" });
  await expect(search).toBeVisible();
  await search.fill("대한");

  const results = page.getByRole("listbox", { name: "플레이 국가 검색 결과" });
  await expect(results).toBeVisible();
  await expect(results.getByRole("option")).toHaveCount(1);
  await page.getByTestId("nation-search-option-nat_kor").click();

  await expect(page.getByTestId("nation-select")).toHaveAttribute("data-selected-id", "nat_kor");
  await expect(page.getByTestId("nation-summary")).toContainText(/대한제국|대한민국/);
});

test("overlays the bounded nation results without reflowing setup", async ({ page }) => {
  // Given
  await openStartScreen(page);
  const setup = page.locator(".start_setup");
  const search = page.getByRole("combobox", { name: "플레이 국가 검색" });
  const scenario = page.getByTestId("scenario-select");
  const before = await setup.boundingBox();

  // When
  await search.focus();
  const results = page.getByRole("listbox", { name: "플레이 국가 검색 결과" });
  await expect(results.getByRole("option")).toHaveCount(8);

  // Then
  const after = await setup.boundingBox();
  const inputBox = await search.boundingBox();
  const scenarioBox = await scenario.boundingBox();
  const resultsBox = await results.boundingBox();
  expect(after?.y).toBe(before?.y);
  expect(after?.height).toBe(before?.height);
  expect(inputBox?.height).toBe(scenarioBox?.height);
  expect(resultsBox?.y).toBeGreaterThanOrEqual((inputBox?.y ?? 0) + (inputBox?.height ?? 0));
});

test("keeps the start flow reachable and the preset editor inside one modal scroller", async ({
  page,
}) => {
  await openStartScreen(page);

  const shell = page.locator(".game_shell");
  const start = page.locator(".start_screen");
  const shellMetrics = await shell.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  const startMetrics = await start.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollTop: element.scrollTop,
  }));
  expect(startMetrics.clientHeight).toBeLessThanOrEqual(shellMetrics.clientHeight);
  expect(startMetrics.overflowY).toBe("auto");

  const startCampaign = page.getByTestId("start-campaign");
  const buttonInitiallyVisible = await startCampaign.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= window.innerHeight;
  });
  if (!buttonInitiallyVisible) {
    await start.hover();
    await page.mouse.wheel(0, 1_200);
    await expect
      .poll(() => start.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(startMetrics.scrollTop);
  }
  await expect(startCampaign).toBeInViewport();

  await page.getByTestId("open-preset-editor").click();
  const modal = page.getByRole("dialog", { name: "세계 프리셋 편집" });
  await expect(modal).toBeVisible();
  const modalBox = await modal.boundingBox();
  const viewport = page.viewportSize();
  if (modalBox === null || viewport === null) {
    throw new Error("Preset modal and viewport must be measurable");
  }
  expect(modalBox.height).toBeLessThanOrEqual(viewport.height - 32);

  const scrollBody = page.getByTestId("preset-scroll-body");
  const scrollMetrics = await scrollBody.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(scrollMetrics.overflowY).toBe("auto");
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
});

test("keeps HUD panels exclusive, closable, and horizontally contained", async ({
  page,
}, testInfo) => {
  await startKoreanCampaign(page);

  await page.getByTestId("oh-actions").click();
  await expect(page.getByRole("region", { name: "행동과 명령" })).toBeVisible();
  await page.getByTestId("oh-search").click();
  await expect(page.getByRole("region", { name: "행동과 명령" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "국가 검색" })).toBeVisible();

  const advisorControl = page.getByTestId("oh-advisor");
  await advisorControl.click();
  expect(await advisorControl.evaluate((element) => getComputedStyle(element).visibility)).toBe(
    "hidden",
  );
  const advisor = page.getByRole("complementary", { name: "전략 자문" });
  await expect(page.getByRole("region", { name: "국가 검색" })).toHaveCount(0);
  await expect(advisor).toBeVisible();
  await expect(page.getByTestId("close-advisor")).toBeVisible();

  const body = page.getByTestId("advisor-scroll-body");
  await expect(body).toHaveCSS("overflow-y", "auto");
  await page.getByRole("button", { name: "군사", exact: true }).click();
  const widthMetrics = await body.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(widthMetrics.scrollWidth).toBeLessThanOrEqual(widthMetrics.clientWidth);

  if (testInfo.project.name === "mobile") {
    await expect(page.getByTestId("oh-actions")).toBeHidden();
    await expect(page.getByTestId("oh-search")).toBeHidden();
  }
  await expect(page.getByTestId("oh-advisor")).toBeHidden();
  await page.getByTestId("close-advisor").click();
  await expect(advisor).toHaveCount(0);
});

test("keeps the command composer text area readable", async ({ page }, testInfo) => {
  // Given
  await startKoreanCampaign(page);

  // When
  await page.getByTestId("oh-actions").click();
  const composer = page.locator(".oh_actions_panel .order_composer textarea");
  await expect(composer).toBeVisible();

  // Then
  await expect(composer).toHaveCSS("word-break", "keep-all");
  const box = await composer.boundingBox();
  const minimumHeight = testInfo.project.name === "mobile" ? 96 : 80;
  expect(box?.height).toBeGreaterThanOrEqual(minimumHeight);
});
