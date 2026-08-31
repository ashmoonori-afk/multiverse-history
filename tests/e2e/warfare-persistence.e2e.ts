import { expect, test } from "@playwright/test";

import { openAdvisor, openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

test.describe("Multiverse History warfare and persistence", () => {
  test("blocks allied war, resolves a legal battle, and restores exported state", async ({
    page,
  }, testInfo) => {
    await startKoreanCampaign(page);

    await openAdvisor(page);
    const advisor = page.getByRole("complementary", { name: "전략 자문" });
    const diplomacyTab = advisor.getByRole("button", { name: "외교", exact: true });
    await diplomacyTab.click();
    await expect(diplomacyTab).toHaveAttribute("aria-current", "page");
    await page.getByTestId("diplomacy-target").selectOption("nat_qing");
    await page.getByTestId("diplomacy-clause").selectOption("alliance");
    await page.getByTestId("propose-treaty").click();

    await page.getByTestId("war-target").selectOption("nat_qing");
    await expect(page.getByTestId("declare-war")).toBeDisabled();
    await page.getByTestId("war-target").selectOption("nat_rus");
    await page.getByTestId("declare-war").click();
    await expect(page.getByTestId("war-status")).toContainText("러시아");

    const militaryTab = advisor.getByRole("button", { name: "군사", exact: true });
    await militaryTab.click();
    await expect(militaryTab).toHaveAttribute("aria-current", "page");
    await page.getByTestId("recruit-province").selectOption("prv_kor_hanseong");
    await page.getByTestId("recruit-unit").click();
    await page.getByTestId("unit-select").selectOption("latest");
    await page.getByTestId("move-province").selectOption("prv_rus_primorye");
    await page.getByTestId("move-unit").click();
    await page.getByTestId("resolve-combat").click();
    await expect(page.getByTestId("battle-report")).toContainText("사상자");
    await expect(page.getByTestId("province-control")).toContainText("대한제국");
    await diplomacyTab.click();
    await expect(diplomacyTab).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("war-status")).toContainText("러시아");

    const turnBeforeReload = await page.getByTestId("oh-date").textContent();
    await openHudPanel(page, "oh-settings", "설정");
    const settings = page.getByRole("region", { name: "설정" });
    await settings.getByRole("button", { name: "저장", exact: true }).click();
    await expect(settings).toContainText("저장됨");
    await page.reload();
    await expect(page.getByTestId("oh-date")).toHaveText(turnBeforeReload ?? "");
    await openAdvisor(page);
    const reloadedAdvisor = page.getByRole("complementary", { name: "전략 자문" });
    const reloadedDiplomacyTab = reloadedAdvisor.getByRole("button", { name: "외교", exact: true });
    await reloadedDiplomacyTab.click();
    await expect(reloadedDiplomacyTab).toHaveAttribute("aria-current", "page");
    await page.getByTestId("war-target").selectOption("nat_qing");
    await expect(page.getByTestId("declare-war")).toBeDisabled();
    await expect(page.getByTestId("war-status")).toContainText("러시아");
    const reloadedMilitaryTab = reloadedAdvisor.getByRole("button", { name: "군사", exact: true });
    await reloadedMilitaryTab.click();
    await expect(reloadedMilitaryTab).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("military-panel")).toBeVisible();
    await expect(page.getByTestId("battle-report")).toContainText("사상자");

    await openHudPanel(page, "oh-settings", "설정");
    const reloadedSettings = page.getByRole("region", { name: "설정" });
    const downloadPromise = page.waitForEvent("download");
    await reloadedSettings.getByRole("button", { name: "내보내기", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("campaign");

    await reloadedSettings.getByRole("button", { name: "새 캠페인", exact: true }).click();
    await expect(page.getByTestId("campaign-shell")).toBeVisible();
    const importedFile = await download.path();
    expect(importedFile).not.toBeNull();
    const importInput = page.getByTestId("import-campaign-input");
    await importInput.setInputFiles(importedFile ?? "");
    await expect(page.getByTestId("oh-date")).toHaveText(turnBeforeReload ?? "");
    await openHudPanel(page, "oh-settings", "설정");
    await expect(page.locator(".oh_state_hash")).toContainText("상태 검증됨");
    await expect(page.locator(".oh_state_hash")).toHaveAttribute("title", /^[a-f0-9]{64}$/);
    await openAdvisor(page);
    const importedAdvisor = page.getByRole("complementary", { name: "전략 자문" });
    const importedMilitaryTab = importedAdvisor.getByRole("button", { name: "군사", exact: true });
    await importedMilitaryTab.click();
    await expect(importedMilitaryTab).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("military-panel")).toBeVisible();
    await expect(page.getByTestId("battle-report")).toContainText("사상자");
    await page.screenshot({
      path: `.omo/evidence/C003/${testInfo.project.name}-warfare-persistence.png`,
    });
  });
});
