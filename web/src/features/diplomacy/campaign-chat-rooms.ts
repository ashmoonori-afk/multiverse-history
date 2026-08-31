import type { CampaignChatMessage } from "../../state/campaign-store";

export interface CampaignChatRoom {
  readonly id: string;
  readonly counterpartNationId: string;
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

const counterpartNationId = (message: CampaignChatMessage, playerNationId: string): string =>
  message.speakerNationId === playerNationId ? message.targetNationId : message.speakerNationId;

export const projectCampaignChatRooms = ({
  messages,
  playerNationId,
  currentTurn,
}: ProjectCampaignChatRoomsInput): readonly CampaignChatRoom[] => {
  const grouped = new Map<string, CampaignChatMessage[]>();
  for (const message of messages) {
    const counterpartId = counterpartNationId(message, playerNationId);
    const roomId = `${counterpartId}:${message.topic}`;
    const roomMessages = grouped.get(roomId);
    if (roomMessages === undefined) {
      grouped.set(roomId, [message]);
    } else {
      roomMessages.push(message);
    }
  }

  return Object.freeze(
    [...grouped.entries()]
      .map(([id, roomMessages]) => {
        const latestMessage = roomMessages.reduce((_, current) => current);
        const counterpartId = counterpartNationId(latestMessage, playerNationId);
        return Object.freeze({
          id,
          counterpartNationId: counterpartId,
          topic: latestMessage.topic,
          subjectKo: subjectByTopic[latestMessage.topic],
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
