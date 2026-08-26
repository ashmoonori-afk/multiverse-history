import { expect, test } from "@playwright/test";

const representatives = [
  { scenarioId: "scn_bronze_1200bc", nationId: "nat_bra", name: "브라질" },
  { scenarioId: "scn_medieval_1200", nationId: "nat_can", name: "캐나다" },
  { scenarioId: "scn_ea1900", nationId: "nat_qing", name: "청제국" },
  { scenarioId: "scn_modern", nationId: "nat_and", name: "안도라" },
] as const;

test.describe("Multiverse History global scenario starts", () => {
  test("starts representative countries and a persisted custom polity", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const scenarioSelect = page.getByTestId("scenario-select");
    await page
      .locator('[data-testid="scenario-select"], [data-testid="campaign-state"]')
      .first()
      .waitFor({ state: "visible" });
    if (await page.getByTestId("campaign-state").isVisible()) {
      await page.getByTestId("new-campaign").click({ force: true });
      await expect(scenarioSelect).toBeVisible();
    }
    await expect(scenarioSelect.locator("option")).toHaveCount(10);

    for (const representative of representatives) {
      await scenarioSelect.selectOption(representative.scenarioId);
      const nationSelect = page.getByTestId("nation-select");
      await expect(nationSelect.locator(`option[value="${representative.nationId}"]`)).toHaveCount(
        1,
      );
      await nationSelect.selectOption(representative.nationId);
      await page.getByTestId("start-campaign").click();
      await expect(page.getByTestId("campaign-state")).toBeVisible();
      await expect(page.locator(".inspector_heading h2")).toHaveText(representative.name);
      await page.getByTestId("new-campaign").click({ force: true });
      await expect(scenarioSelect).toBeVisible();
      await expect(scenarioSelect.locator("option")).toHaveCount(10);
    }

    await scenarioSelect.selectOption("scn_bronze_1200bc");
    const customNationSelect = page.getByTestId("nation-select");
    await expect(customNationSelect.locator('option[value="nat_bra"]')).toHaveCount(1);
    await customNationSelect.selectOption("nat_bra");
    await page.getByTestId("custom-polity-toggle").check();
    await page.getByTestId("custom-polity-name").fill("한성 연방");
    await page.getByTestId("start-campaign").click();
    await expect(page.getByTestId("campaign-state")).toBeVisible();
    await expect(page.locator(".inspector_heading h2")).toHaveText("한성 연방");
    await page.screenshot({
      path: `.omo/evidence/G002-C001/${testInfo.project.name}-representative-starts.png`,
    });
  });
});
