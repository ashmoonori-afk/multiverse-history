import { expect, test } from "@playwright/test";

import { openAdvisor, startKoreanCampaign } from "./helpers/open-historia";

test.describe("Multiverse History diplomacy chat", () => {
  test("routes nation messages through the persisted room and keeps advisor assistance", async ({
    page,
  }) => {
    // Given
    await startKoreanCampaign(page);
    await openAdvisor(page);
    const advisor = page.getByRole("complementary", { name: "전략 자문" });
    const diplomacyTab = advisor.getByRole("button", { name: "외교", exact: true });
    await diplomacyTab.click();
    await expect(diplomacyTab).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("diplomacy-panel")).toBeVisible();
    await expect(page.getByTestId("diplomacy-chat-input")).toHaveCount(0);

    // When
    await page.getByTestId("diplomacy-target").selectOption("nat_jpn");
    await page.getByTestId("advisor-assist").click();
    await expect(page.getByTestId("advisor-suggestion")).toContainText("일본제국");
    await page.getByTestId("close-advisor").click();
    await page.getByTestId("oh-chat").click();
    await page.getByTestId("new-chat").click();
    await page.getByTestId("chat-target").selectOption("nat_jpn");
    await page.getByTestId("chat-input").fill("통상 협정을 논의하고 싶습니다.");
    const reply = page.waitForResponse(
      (response) => response.url().endsWith("/api/diplomacy/chat") && response.ok(),
    );
    await page.getByTestId("send-chat").click();
    await reply;
    await page.getByTestId("chat-room").filter({ hasText: "일본제국" }).click();

    // Then
    await expect(page.getByTestId("chat-room-thread")).toContainText("통상 협정");
    await expect(page.getByTestId("chat-room-thread")).toContainText("일본제국");
  });
});
