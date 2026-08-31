import { expect, test } from "@playwright/test";

import { openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

test("renders independently authored campaign news instead of parroting the action", async ({
  page,
}) => {
  const order = "평양에 제철소를 건설하고 러시아와 기술협정을 체결한다";
  await startKoreanCampaign(page);
  await openHudPanel(page, "oh-actions", "행동과 명령");
  await page.getByTestId("order-input").fill(order);
  await page.getByTestId("turn-cadence").selectOption("month");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/turns/preview") &&
      response.request().method() === "POST" &&
      response.ok(),
  );

  await page.getByTestId("advance-turn").click();
  const response = await responsePromise;
  const responseBody = await response.json();
  const article = responseBody.campaign.resolutions[0].article;

  expect(article.headlineKo).not.toContain(order);
  expect(article.ledeKo).not.toContain(order);
  expect(article.paragraphsKo).toHaveLength(2);
  expect(article.paragraphsKo).not.toContain(order);
  const result = page.getByTestId("campaign-result-panel");
  await expect(result.getByTestId("resolution-order")).toHaveText(order);
  await expect(result.getByTestId("resolution-article-headline")).toHaveText(article.headlineKo);
  await expect(result.getByTestId("resolution-article-body")).not.toContainText(order);

  await page.getByTestId("oh-advisor").click();
  const advisor = page.getByRole("complementary", { name: "전략 자문" });
  await advisor.getByRole("button", { name: "기록", exact: true }).click();
  const timelineArticle = page
    .getByTestId("timeline-news-list")
    .getByTestId("timeline-news-article");
  await expect(timelineArticle).toBeVisible();
  await expect(timelineArticle.getByTestId("resolution-article-headline")).toHaveText(
    article.headlineKo,
  );
  await expect(timelineArticle.getByTestId("resolution-article-body")).not.toContainText(order);
  await page.screenshot({
    path: ".omo/evidence/simulation-six/generative-news-desktop.png",
  });
});
