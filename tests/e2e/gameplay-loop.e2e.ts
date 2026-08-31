import { expect, test } from "@playwright/test";

import { openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

test.describe("Open Historia visible gameplay loop", () => {
  test("resolves an order into timestamped world impact", async ({ page }, testInfo) => {
    await startKoreanCampaign(page);
    await openHudPanel(page, "oh-actions", "행동과 명령");

    await page.getByTestId("order-input").fill("철도망을 확장하고 일본에 통상 협정을 제안한다");
    await page.getByTestId("advance-turn").click();
    await expect(page.getByTestId("resolution-summary")).toContainText("최근 확정 결과");
    await expect(page.getByTestId("campaign-state")).toBeVisible();
    await expect(page.getByTestId("open-historia-world")).toHaveAttribute(
      "data-map-data-state",
      "ready",
    );

    await page.screenshot({
      path: `.omo/evidence/gameplay/open-historia-order-${testInfo.project.name}.png`,
    });
  });

  test("opens diplomatic chat and keeps the campaign usable", async ({ page }, testInfo) => {
    await startKoreanCampaign(page);
    await openHudPanel(page, "oh-chat", "외교 채팅");

    await page.getByTestId("new-chat").click();
    await page.getByTestId("chat-target").selectOption("nat_jpn");
    await page.getByTestId("chat-input").fill("상호 통상을 제안합니다.");
    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/diplomacy/chat") && response.ok(),
    );
    await page.getByTestId("send-chat").click();
    await responsePromise;
    const japanRoom = page.getByTestId("chat-room").filter({ hasText: "일본제국" });
    await expect(japanRoom).toHaveCount(1);
    await japanRoom.click();
    await expect(page.getByTestId("chat-room-thread")).toContainText("일본제국");
    await expect(page.getByTestId("chat-reply")).toHaveCount(1);
    await expect(page.getByTestId("chat-reply").last()).toBeVisible();

    await page.getByTestId("close-chat").click();
    await expect(page.getByRole("region", { name: "외교 채팅" })).toHaveCount(0);
    await expect(page.getByTestId("campaign-state")).toBeVisible();
    await page.screenshot({
      path: `.omo/evidence/gameplay/open-historia-chat-${testInfo.project.name}.png`,
    });
  });

  test("preserves MapLibre camera and fixed HUD while navigating", async ({ page }, testInfo) => {
    await startKoreanCampaign(page);
    const world = page.getByTestId("open-historia-world");
    const canvas = world.locator(".maplibregl-canvas");
    const before = await world.getAttribute("data-camera");
    const box = await canvas.boundingBox();
    if (box === null) {
      throw new Error("MapLibre canvas must be laid out");
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -500);
    await expect(world).not.toHaveAttribute("data-camera", before ?? "");
    await expect(page.getByTestId("oh-settings")).toBeVisible();
    await expect(page.getByTestId("oh-date")).toBeVisible();
    await expect(page.getByTestId("oh-chat")).toBeVisible();
    await expect(page.getByTestId("oh-actions")).toBeVisible();

    await page.screenshot({
      path: `.omo/evidence/gameplay/open-historia-map-${testInfo.project.name}.png`,
    });
  });
});
