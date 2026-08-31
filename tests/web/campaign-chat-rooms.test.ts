import { describe, expect, test } from "bun:test";
import { projectCampaignChatRooms } from "../../web/src/features/diplomacy/campaign-chat-rooms";
import type { CampaignChatMessage } from "../../web/src/state/campaign-store";

const date = Object.freeze({ year: 1900, quarter: 1 });

describe("campaign chat room projection", () => {
  test("groups one counterpart topic into one ordered room", () => {
    // Given
    const messages = [
      {
        id: "chat_1_0",
        role: "counterpart",
        speakerNationId: "nat_jpn",
        targetNationId: "nat_kor",
        roomId: "nat_jpn:trade",
        participantNationIds: ["nat_kor", "nat_jpn"],
        sequence: 1,
        topic: "trade",
        intent: "proposal",
        sourceKey: "diplomacy:trade:nat_kor:nat_jpn",
        turn: 1,
        date,
        text: "통상 협정 실무 회담을 요청합니다.",
      },
      {
        id: "chat_1_1",
        role: "player",
        speakerNationId: "nat_kor",
        targetNationId: "nat_jpn",
        roomId: "nat_jpn:trade",
        participantNationIds: ["nat_kor", "nat_jpn"],
        sequence: 0,
        topic: "trade",
        intent: "rejection",
        replyToMessageId: "chat_1_0",
        turn: 1,
        date,
        text: "싫엉",
      },
      {
        id: "chat_1_2",
        role: "counterpart",
        speakerNationId: "nat_jpn",
        targetNationId: "nat_kor",
        roomId: "nat_jpn:trade",
        participantNationIds: ["nat_kor", "nat_jpn"],
        sequence: 1,
        topic: "trade",
        intent: "acknowledgement",
        replyToMessageId: "chat_1_1",
        turn: 1,
        date,
        text: "후속 협의를 중단하겠습니다.",
      },
      {
        id: "chat_1_3",
        role: "counterpart",
        speakerNationId: "nat_qing",
        targetNationId: "nat_kor",
        roomId: "nat_qing:relations",
        participantNationIds: ["nat_kor", "nat_qing"],
        sequence: 1,
        topic: "relations",
        intent: "statement",
        turn: 1,
        date,
        text: "관계 개선 회담을 제안합니다.",
      },
    ] as const satisfies readonly CampaignChatMessage[];

    // When
    const rooms = projectCampaignChatRooms({
      messages,
      playerNationId: "nat_kor",
      currentTurn: 1,
    });

    // Then
    const japanRoom = rooms.find((room) => room.counterpartNationId === "nat_jpn");
    expect(rooms).toHaveLength(2);
    expect(japanRoom).toMatchObject({
      id: "nat_jpn:trade",
      subjectKo: "통상 협의",
      previewKo: "후속 협의를 중단하겠습니다.",
      unreadCount: 2,
    });
    expect(japanRoom?.messages.map((message) => message.id)).toEqual([
      "chat_1_0",
      "chat_1_1",
      "chat_1_2",
    ]);
  });
});
