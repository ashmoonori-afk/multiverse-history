import type { CampaignChatMessage } from "../../state/campaign-store";

export interface CampaignChatRoom {
  readonly id: string;
  readonly counterpartNationId: string;
  readonly counterpartNationIds: readonly string[];
  readonly topic: CampaignChatMessage["topic"];
  readonly subjectKo: string;
  readonly previewKo: string;
  readonly latestTurn: number;
  readonly latestDate: CampaignChatMessage["date"];
  readonly unreadCount: number;
  readonly messages: readonly CampaignChatMessage[];
}

interface ProjectCampaignChatRoomsInput {
  readonly messages: readonly CampaignChatMessage[];
  readonly playerNationId: string;
  readonly currentTurn: number;
}

const subjectByTopic: Readonly<Record<CampaignChatMessage["topic"], string>> = Object.freeze({
  trade: "통상 협의",
  relations: "관계 개선 회담",
  military: "군사 협의",
  general: "외교 회담",
});

const counterpartNationIds = (
  message: CampaignChatMessage,
  playerNationId: string,
): readonly string[] => {
  const participants =
    message.participantNationIds.length > 0
      ? message.participantNationIds
      : [message.speakerNationId, message.targetNationId];
  return participants.filter((nationId) => nationId !== playerNationId);
};

const roomKey = (message: CampaignChatMessage, counterpartIds: readonly string[]): string =>
  message.roomId.length > 0
    ? message.roomId
    : `${counterpartIds[0] ?? message.speakerNationId}:${message.topic}`;

export const projectCampaignChatRooms = ({
  messages,
  playerNationId,
  currentTurn,
}: ProjectCampaignChatRoomsInput): readonly CampaignChatRoom[] => {
  const grouped = new Map<string, CampaignChatMessage[]>();
  for (const message of messages) {
    const key = roomKey(message, counterpartNationIds(message, playerNationId));
    const roomMessages = grouped.get(key);
    if (roomMessages === undefined) {
      grouped.set(key, [message]);
    } else {
      roomMessages.push(message);
    }
  }

  return Object.freeze(
    [...grouped.entries()]
      .map(([id, roomMessages]) => {
        const latestMessage = roomMessages.reduce((_, current) => current);
        const counterpartIds = [
          ...new Set(
            roomMessages.flatMap((message) => counterpartNationIds(message, playerNationId)),
          ),
        ];
        const subjectKo = subjectByTopic[latestMessage.topic];
        return Object.freeze({
          id,
          counterpartNationId: counterpartIds[0] ?? latestMessage.speakerNationId,
          counterpartNationIds: Object.freeze(counterpartIds),
          topic: latestMessage.topic,
          subjectKo: counterpartIds.length > 1 ? `다자 ${subjectKo}` : subjectKo,
          previewKo: latestMessage.text,
          latestTurn: latestMessage.turn,
          latestDate: latestMessage.date,
          unreadCount: roomMessages.filter(
            (message) => message.role === "counterpart" && message.turn === currentTurn,
          ).length,
          messages: Object.freeze([...roomMessages]),
        });
      })
      .sort((left, right) => right.latestTurn - left.latestTurn),
  );
};
