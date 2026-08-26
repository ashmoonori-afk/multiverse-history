import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const startKoreanCampaign = async (page: Page): Promise<void> => {
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
  await scenarioSelect.selectOption("scn_ea1900");
  await page.getByTestId("nation-select").selectOption("nat_kor");
  await page.getByTestId("start-campaign").click();
  await expect(page.getByTestId("campaign-state")).toBeVisible();
};

test.describe("Multiverse History keyboard and responsive QA", () => {
  test("keeps tab interaction keyboard-accessible without mobile overflow", async ({
    page,
  }, testInfo) => {
    // Given
    await startKoreanCampaign(page);

    // When
    await page.getByTestId("diplomacy-tab").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("military-tab").focus();
    await page.keyboard.press("Enter");

    // Then
    await expect(page.getByTestId("military-tab")).toHaveAttribute("aria-selected", "true");
    const layout = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      touchTargets: [
        ...document.querySelectorAll<HTMLElement>(".inspector_tabs button, .mobile_nav button"),
      ].map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport);
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewport);
    expect(layout.touchTargets.every((target) => target.width >= 44 && target.height >= 44)).toBe(
      true,
    );
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-keyboard-responsive.png`,
    });
  });
});
