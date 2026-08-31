import { expect, test } from "@playwright/test";

import { openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

test.describe("Multiverse History persistence", () => {
  test("saves, reloads, exports, and imports the committed campaign", async ({
    page,
  }, testInfo) => {
    // Given
    await startKoreanCampaign(page);
    await openHudPanel(page, "oh-actions", "행동과 명령");
    await page.getByTestId("order-input").fill("철도망을 확장하고 일본에 통상 협정을 제안한다");
    await page.getByTestId("advance-turn").click();
    const turnBeforeReload = page.getByTestId("oh-date");
    await expect(turnBeforeReload).toContainText("1900년 2분기");

    // When
    await openHudPanel(page, "oh-settings", "설정");
    const settings = page.getByRole("region", { name: "설정" });
    await settings.getByRole("button", { name: "저장", exact: true }).click();
    await expect(settings).toContainText("저장됨");
    const turnBeforeReloadText = await turnBeforeReload.textContent();
    const downloadPromise = page.waitForEvent("download");
    await settings.getByRole("button", { name: "내보내기", exact: true }).click();
    const download = await downloadPromise;

    // Then
    await page.reload();
    await expect(page.getByTestId("oh-date")).toHaveText(turnBeforeReloadText ?? "");
    await openHudPanel(page, "oh-settings", "설정");
    await page
      .getByRole("region", { name: "설정" })
      .getByRole("button", { name: "새 캠페인", exact: true })
      .click();
    await expect(page.getByTestId("import-campaign-input")).toBeVisible();
    const importedFile = await download.path();
    expect(importedFile).not.toBeNull();
    await page.getByTestId("import-campaign-input").setInputFiles(importedFile ?? "");
    await expect(page.getByTestId("oh-date")).toHaveText(turnBeforeReloadText ?? "");
    await openHudPanel(page, "oh-settings", "설정");
    await expect(page.locator(".oh_state_hash")).toHaveAttribute("title", /^[a-f0-9]{64}$/);
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-persistence.png`,
    });
  });
});
