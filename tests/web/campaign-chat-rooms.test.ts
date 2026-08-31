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
    expect(japanRoom?.counterpartNationIds).toEqual(["nat_jpn"]);
  });

  test("keeps one group room for every participant and preserves reply sequence", () => {
    // Given
    const participantNationIds = ["nat_kor", "nat_jpn", "nat_qing", "nat_rus"] as const;
    const roomId = "group:nat_jpn+nat_qing+nat_rus:trade";
    const messages = [
      {
        id: "chat_2_0",
        role: "player",
        speakerNationId: "nat_kor",
        targetNationId: "nat_jpn",
        roomId,
        participantNationIds: [...participantNationIds],
        sequence: 0,
        topic: "trade",
        intent: "proposal",
        turn: 2,
        date,
        text: "삼국 통상 회담을 함께 열고자 합니다.",
      },
      {
        id: "chat_2_1",
        role: "counterpart",
        speakerNationId: "nat_jpn",
        targetNationId: "nat_kor",
        roomId,
        participantNationIds: [...participantNationIds],
        sequence: 1,
        topic: "trade",
        intent: "acceptance",
        replyToMessageId: "chat_2_0",
        turn: 2,
        date,
        text: "일본제국은 관세 조정을 조건으로 참여합니다.",
      },
      {
        id: "chat_2_2",
        role: "counterpart",
        speakerNationId: "nat_qing",
        targetNationId: "nat_kor",
        roomId,
        participantNationIds: [...participantNationIds],
        sequence: 2,
        topic: "trade",
        intent: "question",
        replyToMessageId: "chat_2_0",
        turn: 2,
        date,
        text: "청은 항구 개방 범위를 먼저 확인하겠습니다.",
      },
      {
        id: "chat_2_3",
        role: "counterpart",
        speakerNationId: "nat_rus",
        targetNationId: "nat_kor",
        roomId,
        participantNationIds: [...participantNationIds],
        sequence: 3,
        topic: "trade",
        intent: "statement",
        replyToMessageId: "chat_2_0",
        turn: 2,
        date,
        text: "러시아제국은 철도 연계를 의제로 추가합니다.",
      },
    ] as const satisfies readonly CampaignChatMessage[];

    // When
    const rooms = projectCampaignChatRooms({
      messages,
      playerNationId: "nat_kor",
      currentTurn: 2,
    });

    // Then
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({
      id: roomId,
      counterpartNationId: "nat_jpn",
      subjectKo: "다자 통상 협의",
      previewKo: "러시아제국은 철도 연계를 의제로 추가합니다.",
      unreadCount: 3,
    });
    expect(rooms[0]?.counterpartNationIds).toEqual(["nat_jpn", "nat_qing", "nat_rus"]);
    expect(rooms[0]?.messages.map((message) => message.id)).toEqual([
      "chat_2_0",
      "chat_2_1",
      "chat_2_2",
      "chat_2_3",
    ]);
    expect(
      rooms[0]?.messages
        .filter((message) => message.role === "counterpart")
        .map((message) => [message.speakerNationId, message.sequence]),
    ).toEqual([
      ["nat_jpn", 1],
      ["nat_qing", 2],
      ["nat_rus", 3],
    ]);
  });

  test("keeps bilateral and group rooms disjoint for the same counterpart topic", () => {
    // Given
    const messages = [
      {
        id: "chat_3_0",
        role: "counterpart",
        speakerNationId: "nat_jpn",
        targetNationId: "nat_kor",
        roomId: "nat_jpn:trade",
        participantNationIds: ["nat_kor", "nat_jpn"],
        sequence: 1,
        topic: "trade",
        intent: "proposal",
        turn: 3,
        date,
        text: "양자 통상 협의를 이어가겠습니다.",
      },
      {
        id: "chat_3_1",
        role: "counterpart",
        speakerNationId: "nat_jpn",
        targetNationId: "nat_kor",
        roomId: "group:nat_jpn+nat_qing:trade",
        participantNationIds: ["nat_kor", "nat_jpn", "nat_qing"],
        sequence: 1,
        topic: "trade",
        intent: "statement",
        turn: 3,
        date,
        text: "다자 회담에서는 별도 안건을 제시합니다.",
      },
    ] as const satisfies readonly CampaignChatMessage[];

    // When
    const rooms = projectCampaignChatRooms({
      messages,
      playerNationId: "nat_kor",
      currentTurn: 3,
    });

    // Then
    expect(rooms.map((room) => room.id)).toEqual(["nat_jpn:trade", "group:nat_jpn+nat_qing:trade"]);
    expect(rooms.map((room) => room.counterpartNationIds)).toEqual([
      ["nat_jpn"],
      ["nat_jpn", "nat_qing"],
    ]);
  });
});
