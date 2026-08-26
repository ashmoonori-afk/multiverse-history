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
  await expect(page.getByTestId("campaign-shell")).toBeVisible();
  await scenarioSelect.selectOption("scn_ea1900");
  await page.getByTestId("nation-select").selectOption("nat_kor");
  await page.getByTestId("start-campaign").click();
  await expect(page.getByTestId("campaign-state")).toBeVisible();
};

test.describe("Multiverse History warfare and persistence", () => {
  test("blocks allied war, resolves a legal battle, and restores exported state", async ({
    page,
  }, testInfo) => {
    await startKoreanCampaign(page);

    await page.getByTestId("diplomacy-tab").click();
    await page.getByTestId("diplomacy-target").selectOption("nat_qing");
    await page.getByTestId("diplomacy-clause").selectOption("alliance");
    await page.getByTestId("propose-treaty").click();
    await expect(page.getByTestId("treaty-list")).toContainText("동맹");

    await page.getByTestId("war-target").selectOption("nat_qing");
    await expect(page.getByTestId("declare-war")).toBeDisabled();
    await page.getByTestId("war-target").selectOption("nat_rus");
    await page.getByTestId("declare-war").click();
    await expect(page.getByTestId("war-status")).toContainText("러시아");

    await page.getByTestId("military-tab").click();
    await page.getByTestId("recruit-province").selectOption("prv_kor_hanseong");
    await page.getByTestId("recruit-unit").click();
    await page.getByTestId("unit-select").selectOption("latest");
    await page.getByTestId("move-province").selectOption("prv_rus_primorye");
    await page.getByTestId("move-unit").click();
    await page.getByTestId("resolve-combat").click();
    await expect(page.getByTestId("battle-report")).toContainText("사상자");
    await expect(page.getByTestId("province-control")).toContainText("대한제국");
    await expect(page.getByTestId("relations-list")).toContainText("러시아");

    const turnBeforeReload = await page.getByTestId("turn-value").textContent();
    await page.getByTestId("save-campaign").click();
    await expect(page.getByTestId("save-status")).toContainText("저장");
    await page.reload();
    await expect(page.getByTestId("turn-value")).toHaveText(turnBeforeReload ?? "");
    await expect(page.getByTestId("treaty-list")).toContainText("동맹");
    await expect(page.getByTestId("battle-report")).toContainText("사상자");
    await page.getByTestId("military-tab").click();
    await expect(page.getByTestId("military-panel")).toBeVisible();
    await expect(page.getByTestId("battle-report")).toContainText("사상자");

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-campaign").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("campaign");

    await page.getByTestId("new-campaign").click();
    await expect(page.getByTestId("campaign-shell")).toBeVisible();
    const importedFile = await download.path();
    expect(importedFile).not.toBeNull();
    const importInput = page.getByTestId("import-campaign-input");
    await importInput.setInputFiles(importedFile ?? "");
    await expect(page.getByTestId("turn-value")).toHaveText(turnBeforeReload ?? "");
    await expect(page.getByTestId("state-hash")).toContainText("상태 검증됨");
    await expect(page.getByTestId("state-hash")).toHaveAttribute("title", /^[a-f0-9]{64}$/);
    await page.getByTestId("military-tab").click();
    await expect(page.getByTestId("military-panel")).toBeVisible();
    await expect(page.getByTestId("battle-report")).toContainText("사상자");
    await page.screenshot({
      path: `.omo/evidence/C003/${testInfo.project.name}-warfare-persistence.png`,
    });
  });
});
