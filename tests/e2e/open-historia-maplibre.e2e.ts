import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { selectStartNation } from "./helpers/open-historia";

const startKoreanCampaign = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page
    .locator('[data-testid="scenario-select"], [data-testid="campaign-state"]')
    .first()
    .waitFor({ state: "visible" });
  if (await page.getByTestId("campaign-state").isVisible()) {
    const directExit = page.getByTestId("new-campaign");
    if ((await directExit.count()) > 0 && (await directExit.isVisible())) {
      await directExit.click({ force: true });
    } else {
      await page.getByTestId("oh-settings").click();
      await page.getByRole("button", { name: "새 캠페인", exact: true }).click();
    }
  }
  await expect(page.getByTestId("catalog-status")).toHaveAttribute("data-loading", "false");
  await page.getByTestId("scenario-select").selectOption("scn_ea1900");
  await selectStartNation(page, "nat_kor");
  await page.getByTestId("start-campaign").click();
  await expect(page.getByTestId("campaign-state")).toBeVisible();
};

test.describe("Open Historia MapLibre substrate", () => {
  test("mounts MapLibre as the complete campaign viewport", async ({ page }) => {
    await startKoreanCampaign(page);

    const world = page.getByTestId("open-historia-world");
    await expect(world).toHaveAttribute("data-map-engine", "maplibre");
    await expect(world).toHaveAttribute("data-map-data-state", "ready");
    await expect(world).toHaveAttribute("data-region-count", "25");
    await expect(world.locator(".maplibregl-map")).toBeVisible();
    await expect(world.locator(".maplibregl-canvas")).toBeVisible();

    const bounds = await world.boundingBox();
    const viewport = page.viewportSize();
    if (bounds === null || viewport === null) {
      throw new Error("MapLibre viewport must be measurable");
    }
    expect(Math.abs(bounds.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.width - viewport.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.height - viewport.height)).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `.omo/evidence/open-historia-clone/actual/${test.info().project.name}-maplibre.png`,
    });
  });

  test("uses the native map camera instead of an SVG transform", async ({ page }) => {
    await startKoreanCampaign(page);
    const world = page.getByTestId("open-historia-world");
    const canvas = world.locator(".maplibregl-canvas");
    const initialCamera = await world.getAttribute("data-camera");
    const box = await canvas.boundingBox();
    if (box === null) {
      throw new Error("MapLibre canvas must be laid out");
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, {
      steps: 6,
    });
    await page.mouse.up();
    await expect(world).not.toHaveAttribute("data-camera", initialCamera ?? "");
    await expect(page.locator(".map_canvas")).toHaveCount(0);
  });
});
