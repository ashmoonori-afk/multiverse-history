import { expect, test } from "@playwright/test";

import { openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

test("shows the chosen action as a causal news result after the selected duration", async ({
  page,
}) => {
  // Given
  await startKoreanCampaign(page);
  await openHudPanel(page, "oh-actions", "행동과 명령");
  const order = "철도망을 확장하고 일본에 통상 협정을 제안한다";
  await page.getByTestId("order-input").fill(order);
  await page.getByTestId("turn-cadence").selectOption("month");

  // When
  const requestPromise = page.waitForRequest(
    (request) => request.url().endsWith("/api/turns/preview") && request.method() === "POST",
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/turns/preview") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.getByTestId("advance-turn").click();
  const request = await requestPromise;
  const response = await responsePromise;

  // Then
  expect(request.postDataJSON()).toMatchObject({ cadence: "month", orderText: order });
  const responseBody = await response.json();
  const resolution = responseBody.campaign.resolutions[0];
  expect(resolution).toMatchObject({
    orderText: order,
    cadence: "month",
    advanceDays: 30,
    nationDeltas: [
      {
        nationId: "nat_kor",
        treasuryCredits: { before: 240, after: 215 },
        infrastructureBps: { before: 2_400, after: 2_650 },
      },
    ],
  });
  expect(resolution.worldImpact.changedNationIds).toContain("nat_jpn");
  const articleSentenceCount = resolution.articleKo.match(/[.!?](?:\s|$)/gu)?.length ?? 0;
  expect(articleSentenceCount).toBeGreaterThanOrEqual(5);
  expect(articleSentenceCount).toBeLessThanOrEqual(7);
  const result = page.getByTestId("campaign-result-panel");
  await expect(result).toBeVisible();
  await expect(result.getByTestId("resolution-order")).toHaveText(order);
  await expect(result.getByTestId("resolution-progress")).toHaveAttribute("data-cadence", "month");
  await expect(result.getByTestId("resolution-world-impact")).toHaveText(
    resolution.worldImpact.summaryKo,
  );
  const resultArticleBody = result.getByTestId("resolution-article-body");
  await expect(resultArticleBody).toContainText(resolution.article.ledeKo);
  for (const paragraph of resolution.article.paragraphsKo) {
    await expect(resultArticleBody).toContainText(paragraph);
  }
  await expect(result.getByTestId("resolution-before-after")).toContainText("240 → 215");
  await expect(result.getByTestId("resolution-before-after")).toContainText("2,400 → 2,650");
  await expect(page.getByTestId("incoming-chat-count")).toHaveText("1");
  await page.getByTestId("oh-advisor").click();
  const advisor = page.getByRole("complementary", { name: "전략 자문" });
  await advisor.getByRole("button", { name: "기록", exact: true }).click();
  const timelineNews = page.getByTestId("timeline-news-list");
  await expect(timelineNews).toBeVisible();
  const timelineArticle = timelineNews.getByTestId("timeline-news-article");
  await expect(timelineArticle).toBeVisible();
  await expect(timelineArticle.getByTestId("resolution-article-headline")).not.toHaveText(order);
  await expect(timelineArticle.getByTestId("resolution-article-meta")).toContainText("1900");
  await expect(timelineArticle.getByTestId("resolution-article-actors")).toContainText("일본제국");
  await expect(timelineArticle.getByTestId("resolution-article-body")).not.toContainText(
    resolution.narrativeKo,
  );
  await expect(timelineArticle.getByTestId("resolution-map-impact")).toBeVisible();
  await expect(timelineNews.getByTestId("resolution-order")).toHaveText(order);
  await expect(page.getByTestId("next-resolution")).toBeInViewport();
  await expect(page.getByTestId("next-resolution")).toBeDisabled();
  await page.getByTestId("close-advisor").click();
  await page.getByTestId("oh-chat").click();
  const roomList = page.getByTestId("chat-room-list");
  await expect(roomList).toBeVisible();
  const japanRoom = roomList.getByTestId("chat-room").filter({ hasText: "일본제국" });
  await expect(japanRoom).toHaveCount(1);
  await expect(japanRoom).toContainText("통상");
  await japanRoom.click();
  const chatThread = page.getByTestId("chat-room-thread");
  await expect(chatThread).toBeVisible();
  const chatReplies = page.getByTestId("chat-reply");
  await expect(chatReplies).toHaveCount(1);
  await expect(chatReplies).toContainText("일본제국");
  await expect(page.getByTestId("incoming-chat-count")).toHaveCount(0);
  await page.getByTestId("chat-input").fill("싫엉");
  await page.getByTestId("send-chat").click();
  await expect(page.getByTestId("chat-player-message").last()).toHaveAttribute(
    "data-intent",
    "rejection",
  );
  await expect(chatReplies).toHaveCount(2);
  await expect(chatReplies.last()).toHaveAttribute("data-topic", "trade");
  await expect(chatReplies.last()).toHaveAttribute("data-intent", "acknowledgement");
  await page.getByTestId("chat-thread-back").click();
  await expect(roomList).toBeVisible();
  await expect(japanRoom.getByTestId("chat-room-unread")).toHaveCount(0);
  await page.getByTestId("close-chat").click();

  await openHudPanel(page, "oh-actions", "행동과 명령");
  await page.getByTestId("result-continue").click();
  await page.getByTestId("order-input").fill(order);
  await page.getByTestId("turn-cadence").selectOption("month");
  const secondResponsePromise = page.waitForResponse(
    (secondResponse) =>
      secondResponse.url().endsWith("/api/turns/preview") &&
      secondResponse.request().method() === "POST" &&
      secondResponse.ok(),
  );
  await page.getByTestId("advance-turn").click();
  await secondResponsePromise;
  await expect(page.getByTestId("incoming-chat-count")).toHaveCount(0);
});
