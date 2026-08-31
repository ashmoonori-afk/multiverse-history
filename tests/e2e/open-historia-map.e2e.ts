import { expect, test } from "@playwright/test";

import { openAdvisor, selectNationFromSearch, startKoreanCampaign } from "./helpers/open-historia";

type Bounds = { x: number; y: number; width: number; height: number };

const overlaps = (first: Bounds, second: Bounds): boolean =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

test.describe("Open Historia MapLibre map surface", () => {
  test("covers the desktop viewport with MapLibre beneath fixed HUD controls", async ({ page }) => {
    await startKoreanCampaign(page);

    const world = page.getByTestId("open-historia-world");
    await expect(world).toHaveAttribute("data-map-engine", "maplibre");
    await expect(world).toHaveAttribute("data-map-data-state", "ready");
    await expect(world.locator(".maplibregl-map")).toBeVisible();
    await expect(world.locator(".maplibregl-canvas")).toBeVisible();

    const worldBounds = await world.boundingBox();
    const viewport = page.viewportSize();
    if (worldBounds === null || viewport === null) {
      throw new Error("the MapLibre world must fill a measurable viewport");
    }
    expect(Math.abs(worldBounds.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(worldBounds.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(worldBounds.width - viewport.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(worldBounds.height - viewport.height)).toBeLessThanOrEqual(1);

    for (const testId of [
      "oh-settings",
      "oh-date",
      "oh-chat",
      "oh-actions",
      "oh-search",
      "oh-advisor",
    ]) {
      const control = page.getByTestId(testId);
      await expect(control).toBeVisible();
      await expect(control).toHaveCSS("position", "fixed");
      const controlBounds = await control.boundingBox();
      if (controlBounds === null) {
        throw new Error(`fixed HUD control ${testId} must be measurable`);
      }
      expect(overlaps(worldBounds, controlBounds)).toBe(true);
    }
  });

  test("updates the MapLibre camera from native drag and wheel input", async ({ page }) => {
    await startKoreanCampaign(page);

    const world = page.getByTestId("open-historia-world");
    const canvas = world.locator(".maplibregl-canvas");
    const initialCamera = await world.getAttribute("data-camera");
    const canvasBounds = await canvas.boundingBox();
    if (initialCamera === null || canvasBounds === null) {
      throw new Error("the MapLibre canvas and camera state must be available");
    }

    const centerX = canvasBounds.x + canvasBounds.width / 2;
    const centerY = canvasBounds.y + canvasBounds.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 120, centerY + 60, { steps: 6 });
    await page.mouse.up();
    await expect(world).not.toHaveAttribute("data-camera", initialCamera);

    const draggedCamera = await world.getAttribute("data-camera");
    if (draggedCamera === null) {
      throw new Error("dragging must retain a camera state");
    }
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -500);
    await expect(world).not.toHaveAttribute("data-camera", draggedCamera);
    await expect(page.locator(".map_canvas")).toHaveCount(0);
  });

  test("keeps licensed 25-region geometry selectable through the HUD and advisor", async ({
    page,
  }) => {
    await startKoreanCampaign(page);

    const world = page.getByTestId("open-historia-world");
    await expect(world).toHaveAttribute("data-map-data-state", "ready");
    await expect(world).toHaveAttribute("data-region-count", "25");

    await selectNationFromSearch(page, "대한제국");
    await expect(page.getByTestId("hud-nation-search")).toHaveAttribute(
      "data-selected-id",
      "nat_kor",
    );
    await openAdvisor(page);
    await expect(page.getByTestId("selected-nation-panel")).toHaveAttribute(
      "data-nation-id",
      "nat_kor",
    );

    await selectNationFromSearch(page, "일본제국");
    await expect(page.getByTestId("hud-nation-search")).toHaveAttribute(
      "data-selected-id",
      "nat_jpn",
    );
    await openAdvisor(page);
    await expect(page.getByTestId("selected-nation-panel")).toHaveAttribute(
      "data-nation-id",
      "nat_jpn",
    );
  });
});
