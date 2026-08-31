import { expect, test } from "@playwright/test";

import {
  openAdvisor,
  openHudPanel,
  selectNationFromSearch,
  startKoreanCampaign,
} from "./helpers/open-historia";

test("keeps orders, diplomacy, timeline, map, export, and settings reachable", async ({ page }) => {
  await startKoreanCampaign(page);

  await openHudPanel(page, "oh-actions", "행동과 명령");
  await page.getByTestId("brainstorm-order").click();
  await expect(page.getByTestId("order-input")).not.toHaveValue("");
  await page.getByTestId("polish-order").click();
  await page.getByTestId("add-order-action").click();
  await expect(page.getByTestId("order-action-list").locator("li")).toHaveCount(1);
  await page.getByTestId("order-input").fill("추가 행동을 포함해 이번 턴을 확정한다");
  await page.getByTestId("advance-turn").click();
  await expect(page.getByTestId("resolution-summary")).toContainText("최근 확정 결과");

  await selectNationFromSearch(page, "일본제국");
  await openAdvisor(page);
  const advisor = page.getByRole("complementary", { name: "전략 자문" });
  await advisor.getByRole("button", { name: "외교", exact: true }).click();
  await expect(advisor).toContainText("일본제국");
  await advisor.getByRole("button", { name: "기록", exact: true }).click();
  await expect(page.getByTestId("timeline-panel")).toBeVisible();
  await page.getByTestId("timeline-save").click();
  await page.getByTestId("close-advisor").click();
  await expect(page.getByRole("complementary", { name: "전략 자문" })).toHaveCount(0);

  await page.getByTestId("oh-settings").click();
  const settings = page.getByRole("region", { name: "설정" });
  await expect(settings).toBeVisible();
  await settings.getByRole("button", { name: "저장", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await settings.getByRole("button", { name: "내보내기", exact: true }).click();
  await downloadPromise;

  await expect(page.getByTestId("open-historia-world")).toHaveAttribute(
    "data-map-data-state",
    "ready",
  );
});
