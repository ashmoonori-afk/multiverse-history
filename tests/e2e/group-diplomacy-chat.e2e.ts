import { expect, type Locator, type Page, test } from "@playwright/test";

import { startKoreanCampaign } from "./helpers/open-historia";

const groupParticipantIds = ["nat_jpn", "nat_qing", "nat_rus"] as const;

const openChatDrawer = async (page: Page): Promise<void> => {
  await page.getByTestId("oh-chat").click();
  await expect(page.getByTestId("chat-drawer")).toBeVisible();
};

const readSequences = async (replies: Locator): Promise<readonly number[]> =>
  await replies.evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute("data-sequence"))),
  );

const expectOrderedGroupReplies = async (page: Page): Promise<void> => {
  const replies = page.getByTestId("chat-reply");
  await expect(replies).toHaveCount(groupParticipantIds.length);
  for (const [index, nationId] of groupParticipantIds.entries()) {
    await expect(replies.nth(index)).toHaveAttribute("data-nation-id", nationId);
  }
  const sequences = await readSequences(replies);
  expect(new Set(sequences).size).toBe(groupParticipantIds.length);
  expect(sequences).toEqual([...sequences].sort((left, right) => left - right));
};

test.describe("Multiverse History group diplomacy chat", () => {
  test("keeps three ordered counterpart replies inside one persisted group room", async ({
    page,
  }, testInfo) => {
    // Given
    await startKoreanCampaign(page);
    await openChatDrawer(page);
    await page.getByTestId("new-chat").click();
    await page.getByTestId("chat-target").selectOption("nat_jpn");
    await page.getByTestId("chat-add-participant").selectOption("nat_qing");
    await page.getByTestId("chat-add-participant").selectOption("nat_rus");
    for (const [index, nationId] of groupParticipantIds.entries()) {
      await expect(page.getByTestId(`chat-participant-${nationId}`)).toHaveAttribute(
        "data-order",
        String(index),
      );
    }

    // When
    await page.getByTestId("chat-input").fill("삼국 통상 회담을 함께 열고자 합니다.");
    const reply = page.waitForResponse(
      (response) => response.url().endsWith("/api/diplomacy/chat") && response.ok(),
    );
    await page.getByTestId("send-chat").click();
    await reply;

    // Then
    const groupRoom = page.locator('[data-testid="chat-room"][data-participant-count="4"]');
    await expect(groupRoom).toHaveCount(1);
    const roomId = await groupRoom.getAttribute("data-room-id");
    await groupRoom.click();
    await expect(page.getByTestId("chat-participants")).toBeVisible();
    for (const nationId of groupParticipantIds) {
      await expect(page.getByTestId(`chat-participant-${nationId}`)).toHaveAttribute(
        "data-selected",
        "true",
      );
    }
    await expectOrderedGroupReplies(page);
    await page.screenshot({
      path:
        testInfo.project.name === "mobile"
          ? ".omo/evidence/simulation-six/group-chat-mobile.png"
          : ".omo/evidence/simulation-six/group-chat-desktop.png",
    });

    // And the room survives a reload with the same ordered thread
    await page.reload();
    await expect(page.getByTestId("campaign-state")).toBeVisible();
    await openChatDrawer(page);
    await page.locator(`[data-testid="chat-room"][data-room-id="${roomId}"]`).click();
    await expectOrderedGroupReplies(page);
  });
});
