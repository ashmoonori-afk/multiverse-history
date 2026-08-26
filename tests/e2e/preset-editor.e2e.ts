import { expect, test } from "@playwright/test";

test.describe("Multiverse History preset editor", () => {
  test("clones, exports, and imports a strict preset", async ({ page }, testInfo) => {
    // Given
    await page.goto("/");
    const editor = page.getByTestId("preset-editor");
    if (!(await editor.isVisible().catch(() => false))) {
      if (
        await page
          .getByTestId("campaign-state")
          .isVisible()
          .catch(() => false)
      ) {
        await page.getByTestId("new-campaign").click();
      }
      await page.getByTestId("open-preset-editor").click();
    }
    await expect(editor).toBeVisible();

    // When
    await page.getByTestId("clone-preset").click();
    await expect(page.getByTestId("preset-status")).toContainText("복제");
    await page.getByTestId("preset-title").fill("1900 동아시아 복제 실험");
    await page.getByTestId("preset-nations").fill("대한제국, 일본제국");
    await expect(page.getByTestId("preset-nations")).toHaveValue("대한제국, 일본제국");
    await page.getByTestId("publish-preset").click();
    await expect(page.getByTestId("preset-status")).toContainText("로컬 게시 완료");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-preset").click();
    const download = await downloadPromise;

    // Then
    const importedFile = await download.path();
    expect(importedFile).not.toBeNull();
    await page.getByTestId("import-preset-input").setInputFiles(importedFile ?? "");
    await expect(page.getByTestId("preset-title")).toHaveValue("1900 동아시아 복제 실험");
    await expect(page.getByTestId("preset-status")).toContainText("가져옴");
    await page.screenshot({
      path: `.omo/evidence/C001/${testInfo.project.name}-preset-editor.png`,
    });
  });
});
