import { expect, test } from "@playwright/test";

import { openAdvisor, openStartScreen, selectStartNation } from "./helpers/open-historia";

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
    await openStartScreen(page);
    const scenarioSelect = page.getByTestId("scenario-select");
    await expect(scenarioSelect.locator("option")).toHaveCount(10);

    for (const representative of representatives) {
      await scenarioSelect.selectOption(representative.scenarioId);
      await selectStartNation(page, representative.nationId);
      await page.getByTestId("start-campaign").click();
      await expect(page.getByTestId("campaign-state")).toBeVisible();
      await openAdvisor(page);
      await expect(page.getByTestId("selected-nation-panel")).toContainText(representative.name);
      await openStartScreen(page);
      await expect(scenarioSelect.locator("option")).toHaveCount(10);
    }

    await scenarioSelect.selectOption("scn_bronze_1200bc");
    await selectStartNation(page, "nat_bra");
    await page.getByTestId("custom-polity-toggle").check();
    await page.getByTestId("custom-polity-name").fill("한성 연방");
    await page.getByTestId("start-campaign").click();
    await expect(page.getByTestId("campaign-state")).toBeVisible();
    await openAdvisor(page);
    await expect(page.getByTestId("selected-nation-panel")).toContainText("한성 연방");
    await page.screenshot({
      path: `.omo/evidence/G002-C001/${testInfo.project.name}-representative-starts.png`,
    });
  });
});
