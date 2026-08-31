import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { openAdvisor, openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

const MAX_UNTIL_EVENT_STEPS = 24;
const MAX_UNTIL_EVENT_DAYS = 548;

/**
 * Every long-horizon progression request is served under the timeline namespace, the same
 * namespace that already owns `/api/timeline/jump`. The in-flight duplicate-click test holds
 * the first response open through this pattern, so a progression endpoint outside the
 * namespace surfaces as a request-count failure rather than a silent timing pass.
 */
const TIMELINE_REQUESTS = "**/api/timeline/**";

const openTimelinePanel = async (page: Page): Promise<Locator> => {
  await startKoreanCampaign(page);
  await openHudPanel(page, "oh-actions", "행동과 명령");
  await page.getByTestId("order-input").fill("철도망을 확장하고 일본에 통상 협정을 제안한다");
  await page.getByTestId("advance-turn").click();
  await expect(page.getByTestId("campaign-result-panel")).toBeVisible();
  await openAdvisor(page);
  const advisor = page.getByRole("complementary", { name: "전략 자문" });
  const timelineTab = advisor.getByRole("button", { name: "기록", exact: true });
  await timelineTab.click();
  await expect(timelineTab).toHaveAttribute("aria-current", "page");
  return page.getByTestId("timeline-progression-mode");
};

test.describe("Multiverse History long-horizon progression", () => {
  test.describe.configure({ timeout: 90_000 });

  test("advances exactly eighteen months when 18개월 is confirmed", async ({ page }, testInfo) => {
    // Given
    const result = await openTimelinePanel(page);

    // When
    await page.getByTestId("progress-18-months").click();

    // Then
    await expect(result).toHaveAttribute("data-progression-mode", "months");
    await expect(result).toHaveAttribute("data-progression-steps", "18");
    await expect(result).toHaveAttribute("data-advance-days", "540");
    await expect(result).toHaveAttribute("data-stop-reason", "requested_duration");
    await page.screenshot({
      path:
        testInfo.project.name === "desktop"
          ? ".omo/evidence/simulation-six/long-horizon-progression.png"
          : `.omo/evidence/simulation-six/long-horizon-progression-${testInfo.project.name}.png`,
    });
  });

  test("stops at the next major event inside the bounded horizon", async ({ page }) => {
    // Given
    const result = await openTimelinePanel(page);

    // When
    await page.getByTestId("progress-until-major-event").click();

    // Then
    await expect(result).toHaveAttribute("data-progression-mode", "until_major_event");
    await expect(result).toHaveAttribute("data-stop-reason", "major_event");
    const steps = Number(await result.getAttribute("data-progression-steps"));
    const advanceDays = Number(await result.getAttribute("data-advance-days"));
    expect(steps).toBeGreaterThan(0);
    expect(steps).toBeLessThanOrEqual(MAX_UNTIL_EVENT_STEPS);
    expect(advanceDays).toBeGreaterThan(0);
    expect(advanceDays).toBeLessThanOrEqual(MAX_UNTIL_EVENT_DAYS);
    const majorEvent = page.getByTestId("timeline-progression-major-event");
    await expect(majorEvent).toBeVisible();
    await expect(majorEvent).not.toBeEmpty();
  });

  test("rejects a duplicate progression request while the first is in flight", async ({ page }) => {
    // Given
    const result = await openTimelinePanel(page);
    let releaseFirstRequest: () => void = () => undefined;
    const firstRequestHeld = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve;
    });
    let progressionRequests = 0;
    await page.route(TIMELINE_REQUESTS, async (route) => {
      progressionRequests += 1;
      if (progressionRequests === 1) {
        await firstRequestHeld;
      }
      await route.continue();
    });

    // When
    await page.getByTestId("progress-18-months").click();
    await page.getByTestId("progress-until-major-event").click({ force: true });
    releaseFirstRequest();

    // Then
    await expect(result).toHaveAttribute("data-progression-mode", "months");
    await expect(result).toHaveAttribute("data-progression-steps", "18");
    expect(progressionRequests).toBe(1);
  });

  test("restores the progression summary after a reload", async ({ page }) => {
    // Given
    const result = await openTimelinePanel(page);
    await page.getByTestId("progress-18-months").click();
    await expect(result).toHaveAttribute("data-advance-days", "540");

    // When
    await page.reload();

    // Then
    await openAdvisor(page);
    await page
      .getByRole("complementary", { name: "전략 자문" })
      .getByRole("button", { name: "기록", exact: true })
      .click();
    const restored = page.getByTestId("timeline-progression-mode");
    await expect(restored).toHaveAttribute("data-progression-mode", "months");
    await expect(restored).toHaveAttribute("data-progression-steps", "18");
    await expect(restored).toHaveAttribute("data-advance-days", "540");
    await expect(restored).toHaveAttribute("data-stop-reason", "requested_duration");
  });
});
