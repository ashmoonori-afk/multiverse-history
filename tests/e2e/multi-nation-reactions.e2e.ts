import { expect, test } from "@playwright/test";

import { openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

const order = "철도망을 확장하고 일본에 통상 협정을 제안한다";

interface ApiReaction {
  readonly id: string;
  readonly nationId: string;
  readonly stance: string;
  readonly sentimentBps: number;
  readonly statementKo: string;
}

test("renders one ordered reaction card per affected nation", async ({ page }, testInfo) => {
  // Given
  await startKoreanCampaign(page);
  await openHudPanel(page, "oh-actions", "행동과 명령");
  await page.getByTestId("order-input").fill("내정을 정비한다");
  const warmupResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/turns/preview") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.getByTestId("advance-turn").click();
  await warmupResponse;
  await page.getByTestId("result-continue").click();
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
  const resolution = body.campaign.resolutions.at(-1);
  const worldEvent = body.campaign.worldEvents.find(
    (candidate: { readonly id: string }) => candidate.id === resolution.worldEventIds[0],
  );
  expect(worldEvent).toBeDefined();
  expect(worldEvent.affectedNationIds.length).toBeGreaterThanOrEqual(3);
  const reactions: readonly ApiReaction[] = resolution.reactionIds.map((reactionId: string) => {
    const reaction = body.campaign.nationReactions.find(
      (candidate: ApiReaction) => candidate.id === reactionId,
    );
    expect(reaction).toBeDefined();
    return reaction;
  });
  expect(reactions.map((reaction) => reaction.nationId)).toEqual(worldEvent.affectedNationIds);
  const nationNameById = new Map<string, string>(
    body.campaign.nations.map((nation: { readonly id: string; readonly nameKo: string }) => [
      nation.id,
      nation.nameKo,
    ]),
  );

  const result = page.getByTestId("campaign-result-panel");
  const reactionRegion = result.getByTestId("resolution-reactions");
  await expect(reactionRegion).toBeVisible();
  await expect(reactionRegion).toHaveAttribute("data-reaction-count", String(reactions.length));

  const reactionCards = reactionRegion.getByTestId("resolution-reaction");
  await expect(reactionCards).toHaveCount(reactions.length);
  const renderedOrder = await reactionCards.evaluateAll((nodes) =>
    nodes.map((node) => ({
      nationId: node.getAttribute("data-nation-id"),
      order: node.getAttribute("data-reaction-order"),
      stance: node.getAttribute("data-stance"),
    })),
  );
  expect(renderedOrder).toEqual(
    reactions.map((reaction, index) => ({
      nationId: reaction.nationId,
      order: String(index + 1),
      stance: reaction.stance,
    })),
  );

  for (const [index, reaction] of reactions.entries()) {
    const card = reactionCards.nth(index);
    await expect(card.getByTestId("resolution-reaction-nation")).toHaveText(
      nationNameById.get(reaction.nationId) ?? reaction.nationId,
    );
    await expect(card.getByTestId("resolution-reaction-statement")).toHaveText(
      reaction.statementKo,
    );
  }

  await reactionRegion.scrollIntoViewIfNeeded();
  await expect(reactionRegion).toBeInViewport();
  await page.screenshot({
    path:
      testInfo.project.name === "desktop"
        ? ".omo/evidence/simulation-six/multi-nation-reactions.png"
        : `.omo/evidence/simulation-six/multi-nation-reactions-${testInfo.project.name}.png`,
    animations: "disabled",
  });

  await page.getByTestId("oh-advisor").click();
  const advisor = page.getByRole("complementary", { name: "전략 자문" });
  await advisor.getByRole("button", { name: "기록", exact: true }).click();
  const timelineReactions = page
    .getByTestId("timeline-news-list")
    .getByTestId("timeline-news-article")
    .getByTestId("resolution-reaction");
  await expect(timelineReactions).toHaveCount(reactions.length);
  const timelineOrder = await timelineReactions.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-nation-id")),
  );
  expect(timelineOrder).toEqual(worldEvent.affectedNationIds);
});
