import { expect, test } from "@playwright/test";

import { startKoreanCampaign } from "./helpers/open-historia";

test("keeps the fixed HUD keyboard-accessible without viewport overflow", async ({
  page,
}, testInfo) => {
  await startKoreanCampaign(page);
  const advisor = page.getByTestId("oh-advisor");
  await advisor.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("complementary", { name: "전략 자문" });
  await expect(drawer).toBeVisible();

  const militaryTab = drawer.getByRole("button", { name: "군사", exact: true });
  await militaryTab.focus();
  await page.keyboard.press("Enter");
  await expect(militaryTab).toHaveAttribute("aria-current", "page");

  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    squareControls: [
      "oh-settings",
      "oh-chat",
      "oh-actions",
      "oh-search",
      "oh-player-flag",
      "oh-advisor",
    ].map((testId) => {
      const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      const box = element?.getBoundingClientRect();
      return box === undefined ? null : { width: box.width, height: box.height };
    }),
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewport);
  expect(
    layout.squareControls.every(
      (target) => target !== null && target.width >= 44 && target.height >= 44,
    ),
  ).toBe(true);

  await page.screenshot({
    path: `.omo/evidence/C001/${testInfo.project.name}-open-historia-keyboard.png`,
  });
});
