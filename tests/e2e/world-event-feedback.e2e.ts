import { expect, test } from "@playwright/test";

import { openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

const order = "철도망을 확장하고 일본에 통상 협정을 제안한다";

test("shows the committed world event with importance, summary, and affected nations", async ({
  page,
}, testInfo) => {
  // Given
  await startKoreanCampaign(page);
  await openHudPanel(page, "oh-actions", "행동과 명령");
  await page.getByTestId("order-input").fill(order);
  await page.getByTestId("turn-cadence").selectOption("month");

  // When
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/turns/preview") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.getByTestId("advance-turn").click();
  const response = await responsePromise;

  // Then
  const body = await response.json();
  const resolution = body.campaign.resolutions[0];
  expect(resolution.worldEventIds).toHaveLength(1);
  const worldEvent = body.campaign.worldEvents.find(
    (candidate: { readonly id: string }) => candidate.id === resolution.worldEventIds[0],
  );
  expect(worldEvent).toBeDefined();
  const nationNameById = new Map<string, string>(
    body.campaign.nations.map((nation: { readonly id: string; readonly nameKo: string }) => [
      nation.id,
      nation.nameKo,
    ]),
  );

  const result = page.getByTestId("campaign-result-panel");
  const eventCard = result.getByTestId("resolution-world-event");
  await expect(eventCard).toBeVisible();
  await expect(eventCard).toHaveAttribute("data-event-id", worldEvent.id);
  await expect(eventCard).toHaveAttribute("data-importance", worldEvent.importance);
  await expect(eventCard).toHaveAttribute("data-kind", worldEvent.kind);
  await expect(eventCard.getByTestId("resolution-world-event-headline")).toHaveText(
    worldEvent.headlineKo,
  );
  await expect(eventCard.getByTestId("resolution-world-event-summary")).toHaveText(
    worldEvent.summaryKo,
  );

  const affectedNations = eventCard.getByTestId("resolution-world-event-nation");
  await expect(affectedNations).toHaveCount(worldEvent.affectedNationIds.length);
  const renderedNationIds = await affectedNations.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-nation-id")),
  );
  expect(renderedNationIds).toEqual(worldEvent.affectedNationIds);
  const renderedNationNames = await affectedNations.evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.trim()),
  );
  expect(renderedNationNames).toEqual(
    worldEvent.affectedNationIds.map((nationId: string) => nationNameById.get(nationId)),
  );

  await eventCard.scrollIntoViewIfNeeded();
  await expect(eventCard).toBeInViewport();
  await page.screenshot({
    path:
      testInfo.project.name === "desktop"
        ? ".omo/evidence/simulation-six/world-event-feedback.png"
        : `.omo/evidence/simulation-six/world-event-feedback-${testInfo.project.name}.png`,
    animations: "disabled",
  });

  await page.getByTestId("oh-advisor").click();
  const advisor = page.getByRole("complementary", { name: "전략 자문" });
  await advisor.getByRole("button", { name: "기록", exact: true }).click();
  const timelineArticle = page
    .getByTestId("timeline-news-list")
    .getByTestId("timeline-news-article");
  const timelineEventCard = timelineArticle.getByTestId("resolution-world-event");
  await expect(timelineEventCard).toBeVisible();
  await expect(timelineEventCard).toHaveAttribute("data-event-id", worldEvent.id);
  await expect(timelineEventCard.getByTestId("resolution-world-event-headline")).toHaveText(
    worldEvent.headlineKo,
  );
  const timelineNationIds = await timelineEventCard
    .getByTestId("resolution-world-event-nation")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-nation-id")));
  expect(timelineNationIds).toEqual(worldEvent.affectedNationIds);
});
