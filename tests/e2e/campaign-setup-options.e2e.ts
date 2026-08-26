import { expect, test } from "@playwright/test";

test.describe("Multiverse History campaign setup", () => {
  test("configures a custom polity, difficulty, and planner model", async ({ page }, testInfo) => {
    // Given
    await page.goto("/");
    await page
      .locator('[data-testid="custom-polity-toggle"], [data-testid="campaign-state"]')
      .first()
      .waitFor({ state: "visible" });
    if (
      await page
        .getByTestId("campaign-state")
        .isVisible()
        .catch(() => false)
    ) {
      await page.getByTestId("new-campaign").click({ force: true });
    }
    await expect(page.getByTestId("custom-polity-toggle")).toBeVisible();

    // When
    await page.getByTestId("custom-polity-toggle").check();
    await page.getByTestId("custom-polity-name").fill("한성 연방");
    await page.getByTestId("difficulty-select").selectOption("hard");
    await page.getByTestId("model-select").selectOption("claude");

    // Then
    await expect(page.getByTestId("setup-summary")).toContainText("한성 연방");
    await expect(page.getByTestId("setup-summary")).toContainText("어려움");
    await expect(page.getByTestId("setup-summary")).toContainText("Claude");
    await page.getByTestId("setup-summary").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-campaign-setup.png`,
    });
  });
});
