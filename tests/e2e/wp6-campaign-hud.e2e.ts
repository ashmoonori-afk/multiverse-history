import { expect, test } from "@playwright/test";

import { openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

const evidenceRoot = ".omo/evidence/pax-parity";

const expectNoDocumentOverflow = async (page: import("@playwright/test").Page): Promise<void> => {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
          document.documentElement.scrollHeight <= document.documentElement.clientHeight,
      ),
    )
    .toBe(true);
};

const expectNoVisibleTopHudOverlap = async (
  page: import("@playwright/test").Page,
): Promise<void> => {
  const overlaps = await page.evaluate(() => {
    const visibleElements = [
      ...["oh-settings", "oh-session", "oh-exit", "oh-date"].map((testId) => ({
        name: testId,
        selector: `[data-testid="${testId}"]`,
      })),
      { name: "actions-panel", selector: ".oh_actions_panel" },
      { name: "settings-panel", selector: ".oh_settings_panel" },
    ].flatMap(({ name, selector }) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element === null || element.getClientRects().length === 0) return [];
      return [{ name, bounds: element.getBoundingClientRect() }];
    });
    return visibleElements.flatMap((left, index) =>
      visibleElements
        .slice(index + 1)
        .flatMap((right) =>
          left.bounds.right <= right.bounds.left ||
          right.bounds.right <= left.bounds.left ||
          left.bounds.bottom <= right.bounds.top ||
          right.bounds.bottom <= left.bounds.top
            ? []
            : [`${left.name}/${right.name}`],
        ),
    );
  });
  expect(overlaps).toEqual([]);
};

const expectDeltaLabelsStayWhole = async (page: import("@playwright/test").Page): Promise<void> => {
  for (const text of ["기반시설", "인구"]) {
    const label = page
      .getByTestId("resolution-before-after")
      .getByText(text, { exact: true })
      .first();
    await expect(label).toBeVisible();
    await expect
      .poll(() =>
        label.evaluate((element) => {
          const row = element.closest("li");
          if (row === null) return false;
          const range = document.createRange();
          range.selectNodeContents(element);
          const bounds = element.getBoundingClientRect();
          const rowBounds = row.getBoundingClientRect();
          return (
            range.getClientRects().length === 1 &&
            bounds.left >= rowBounds.left &&
            bounds.right <= rowBounds.right &&
            row.scrollWidth <= row.clientWidth
          );
        }),
      )
      .toBe(true);
  }
};

const expectBoundedScrollableActionsPanel = async (
  page: import("@playwright/test").Page,
): Promise<void> => {
  const panel = page.locator(".oh_actions_panel");
  const scrollArea = page.getByTestId("campaign-result-panel");
  const continueButton = page.getByTestId("result-continue");
  await expect(panel).toBeVisible();
  const bounds = await panel.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return { top: rectangle.top, bottom: rectangle.bottom, viewportHeight: window.innerHeight };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);

  const scrollMetrics = await scrollArea.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  await scrollArea.evaluate((element) => (element.scrollTop = element.scrollHeight));
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect
    .poll(() =>
      continueButton.evaluate((element) => {
        const buttonBounds = element.getBoundingClientRect();
        const panelBounds = element.closest(".oh_actions_panel")?.getBoundingClientRect();
        return (
          panelBounds !== undefined &&
          buttonBounds.top >= panelBounds.top &&
          buttonBounds.bottom <= panelBounds.bottom
        );
      }),
    )
    .toBe(true);
  await scrollArea.evaluate((element) => (element.scrollTop = 0));
};

const positionResultHeadingsInScrollport = async (
  page: import("@playwright/test").Page,
): Promise<void> => {
  const scrollArea = page.getByTestId("campaign-result-panel");
  const selectors = [
    '[data-testid="resolution-article-headline"]',
    '[data-testid="resolution-policy-deltas"] h3',
    '[data-testid="resolution-tick-deltas"] h3',
  ];
  await scrollArea.evaluate((element, headingSelectors) => {
    if (!(element instanceof HTMLElement)) throw new TypeError("Result panel is not HTML");
    const panelBounds = element.getBoundingClientRect();
    const scale = panelBounds.height / element.offsetHeight;
    const headingBounds = headingSelectors.map((selector) => {
      const heading = element.querySelector(selector);
      if (heading === null) throw new Error(`Missing result heading: ${selector}`);
      return heading.getBoundingClientRect();
    });
    const contentTop =
      element.scrollTop +
      (Math.min(...headingBounds.map((bounds) => bounds.top)) - panelBounds.top) / scale;
    const contentBottom =
      element.scrollTop +
      (Math.max(...headingBounds.map((bounds) => bounds.bottom)) - panelBounds.top) / scale;
    element.scrollTop = Math.max(
      0,
      Math.min(
        element.scrollHeight - element.clientHeight,
        (contentTop + contentBottom - element.clientHeight) / 2,
      ),
    );
  }, selectors);
  await expect
    .poll(() =>
      scrollArea.evaluate((element, headingSelectors) => {
        const panelBounds = element.getBoundingClientRect();
        return headingSelectors.every((selector) => {
          const bounds = element.querySelector(selector)?.getBoundingClientRect();
          return (
            bounds !== undefined &&
            bounds.left >= panelBounds.left &&
            bounds.right <= panelBounds.right &&
            bounds.top >= panelBounds.top &&
            bounds.bottom <= panelBounds.bottom
          );
        });
      }, selectors),
    )
    .toBe(true);
};

const expectResultHeadingsInViewport = async (
  page: import("@playwright/test").Page,
): Promise<void> => {
  for (const heading of [
    page.getByTestId("resolution-article-headline"),
    page.getByTestId("resolution-policy-deltas").getByRole("heading"),
    page.getByTestId("resolution-tick-deltas").getByRole("heading"),
  ]) {
    await expect(heading).toBeVisible();
    await expect
      .poll(() =>
        heading.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
        }),
      )
      .toBe(true);
  }
};

const expectSettledSaveInViewport = async (
  page: import("@playwright/test").Page,
  expectedStatus: string | RegExp = /^(?:year-one 슬롯 저장됨|현재 턴 1)$/,
): Promise<void> => {
  const slot = page.getByTestId("save-slot-year-one");
  const status = page.getByTestId("save-menu-status");
  await expect(slot).toContainText("턴 1");
  await expect(status).toHaveText(expectedStatus);
  const currentHash = (await page.locator(".oh_state_hash").innerText()).replace("상태 ", "");
  await expect(slot).toContainText(currentHash);
  for (const element of [slot, status]) {
    await expect
      .poll(() =>
        element.evaluate((node) => {
          const bounds = node.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
        }),
      )
      .toBe(true);
  }
};

test("commits a one-year result, attributes deltas, and saves a slot", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await startKoreanCampaign(page);
  await openHudPanel(page, "oh-actions", "행동과 명령");

  await page.getByTestId("turn-cadence").selectOption("year");
  await page.getByTestId("order-input").fill("제주에 공항을 건설한다");
  await page.getByTestId("advance-turn").click();
  await expect(page.getByTestId("resolution-summary")).toContainText("최근 확정 결과");
  await expect(page.getByTestId("resolution-policy-deltas")).toContainText("정책 결과");
  await expect(page.getByTestId("resolution-tick-deltas")).toContainText("시간 경과");
  await expectResultHeadingsInViewport(page);
  await expectNoVisibleTopHudOverlap(page);
  await expectDeltaLabelsStayWhole(page);
  await page.screenshot({ path: `${evidenceRoot}/wp6-result-1280.png` });

  await openHudPanel(page, "oh-settings", "설정");
  await page.getByTestId("save-slot-id").fill("Year One!");
  await expect(page.getByTestId("save-slot-submit")).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("소문자");
  await page.getByTestId("save-slot-id").fill("year-one");
  await page.getByTestId("save-slot-submit").click();
  await expectSettledSaveInViewport(page, "year-one 슬롯 저장됨");
  await page.screenshot({ path: `${evidenceRoot}/wp6-save-1280.png` });

  const loadButton = page.getByRole("button", { name: "year-one 슬롯 불러오기" });
  await loadButton.click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation.getByRole("button", { name: "불러오기 확인" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirmation.getByRole("button", { name: "취소" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirmation.getByRole("button", { name: "불러오기 확인" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(loadButton).toBeFocused();

  for (const width of [768, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoDocumentOverflow(page);
    await openHudPanel(page, "oh-actions", "행동과 명령");
    await expectResultHeadingsInViewport(page);
    if (width === 768) {
      await expectNoVisibleTopHudOverlap(page);
      await expectDeltaLabelsStayWhole(page);
    }
    await page.screenshot({ path: `${evidenceRoot}/wp6-result-${width}.png` });
    await openHudPanel(page, "oh-settings", "설정");
    await expectSettledSaveInViewport(page);
    if (width === 768) await expectNoVisibleTopHudOverlap(page);
    await page.screenshot({ path: `${evidenceRoot}/wp6-save-${width}.png` });
  }

  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoDocumentOverflow(page);
  }

  await openHudPanel(page, "oh-actions", "행동과 명령");
  await page
    .getByTestId("campaign-result-panel")
    .evaluate((element) => (element.scrollTop = element.scrollHeight));
  await page.getByTestId("result-continue").click();
  await expect(page.getByTestId("order-input")).toHaveValue("");
  await page.getByTestId("advance-time-only").click();
  await expect(page.getByTestId("resolution-order")).toContainText("시간 진행");
  await expect
    .poll(() => page.getByTestId("campaign-result-panel").evaluate((element) => element.scrollTop))
    .toBe(0);

  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expectNoDocumentOverflow(page);
  await expectNoVisibleTopHudOverlap(page);
  await expectBoundedScrollableActionsPanel(page);
  await positionResultHeadingsInScrollport(page);
  await expectResultHeadingsInViewport(page);
  await page.screenshot({ path: `${evidenceRoot}/wp6-zoom-200.png` });
});
