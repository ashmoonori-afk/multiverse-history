import { z } from "zod";

import {
  classifyCampaignChatMessage,
  deterministicCounterpartReply,
} from "./campaign-chat-decision";
import type { CampaignState } from "./campaign-state";

export {
  classifyCampaignChatMessage,
  deterministicCounterpartReply,
} from "./campaign-chat-decision";

export interface CampaignChatMessage {
  readonly id: string;
  readonly role: "player" | "counterpart";
  readonly speakerNationId: string;
  readonly targetNationId: string;
  readonly roomId: string;
  readonly participantNationIds: readonly string[];
  readonly sequence: number;
  readonly topic: CampaignChatTopic;
  readonly intent: CampaignChatIntent;
  readonly replyToMessageId?: string;
  readonly sourceKey?: string;
  readonly turn: number;
  readonly date: { readonly year: number; readonly quarter: number };
  readonly text: string;
}

export type CampaignChatTopic = "trade" | "relations" | "military" | "general";
export type CampaignChatIntent =
  | "proposal"
  | "acceptance"
  | "rejection"
  | "question"
  | "statement"
  | "acknowledgement";

export const CampaignChatMessageSchema = z
  .object({
    id: z.string().regex(/^chat_[a-z0-9_]+$/),
    role: z.enum(["player", "counterpart"]),
    speakerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    targetNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    roomId: z.string().default(""),
    participantNationIds: z.array(z.string().regex(/^nat_[a-z0-9_]+$/)).default([]),
    sequence: z.number().safe().int().nonnegative().default(0),
    topic: z.enum(["trade", "relations", "military", "general"]).default("general"),
    intent: z
      .enum(["proposal", "acceptance", "rejection", "question", "statement", "acknowledgement"])
      .default("statement"),
    replyToMessageId: z
      .string()
      .regex(/^chat_[a-z0-9_]+$/)
      .optional(),
    sourceKey: z.string().min(1).optional(),
    turn: z.number().safe().int().nonnegative(),
    date: z
      .object({
        year: z.number().safe().int(),
        quarter: z.number().safe().int().min(1).max(4),
      })
      .strict(),
    text: z.string().min(1).max(4_000),
  })
  .strict();

const orderedUnique = (values: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(values)]);

export const campaignChatRoomId = (
  playerNationId: string,
  participantNationIds: readonly string[],
  topic: CampaignChatTopic,
): string => {
  const counterparts = [...new Set(participantNationIds)]
    .filter((nationId) => nationId !== playerNationId)
    .sort();
  return counterparts.length === 1
    ? `${counterparts[0]}:${topic}`
    : `group:${counterparts.join("+")}:${topic}`;
};

export const normalizeCampaignChatMessage = (
  message: CampaignChatMessage,
  playerNationId: string,
): CampaignChatMessage => {
  const participantNationIds =
    message.participantNationIds.length === 0
      ? orderedUnique([playerNationId, message.speakerNationId, message.targetNationId])
      : orderedUnique(message.participantNationIds);
  return Object.freeze({
    ...message,
    roomId:
      message.roomId.length === 0
        ? campaignChatRoomId(playerNationId, participantNationIds, message.topic)
        : message.roomId,
    participantNationIds,
  });
};

export interface AppendCampaignChatInput {
  readonly state: CampaignState;
  readonly targetNationId: string;
  readonly message: string;
  readonly decision?: CampaignChatDecision;
  readonly replyText?: string;
}

export interface AppendIncomingCampaignChatInput {
  readonly state: CampaignState;
  readonly speakerNationId: string;
  readonly turn: number;
  readonly message: string;
  readonly topic: CampaignChatTopic;
  readonly intent: CampaignChatIntent;
  readonly sourceKey: string;
}

export interface CampaignChatDecision {
  readonly topic: CampaignChatTopic;
  readonly intent: Exclude<CampaignChatIntent, "proposal" | "acknowledgement">;
  readonly replyToMessageId?: string;
}

export const appendCampaignChat = (input: AppendCampaignChatInput): CampaignState => {
  const message = input.message.trim();
  const player = input.state.nations.find((nation) => nation.id === input.state.playerNationId);
  const target = input.state.nations.find((nation) => nation.id === input.targetNationId);
  if (message.length === 0 || player === undefined || target === undefined) {
    throw new RangeError("CHAT_TARGET_INVALID");
  }
  const offset = input.state.chatMessages.length;
  const decision =
    input.decision ??
    classifyCampaignChatMessage({
      state: input.state,
      targetNationId: target.id,
      message,
    });
  const playerMessageId = `chat_${input.state.turn}_${offset}`;
  const participantNationIds = Object.freeze([player.id, target.id]);
  const roomId = campaignChatRoomId(player.id, participantNationIds, decision.topic);
  const messages: readonly CampaignChatMessage[] = Object.freeze([
    Object.freeze({
      id: playerMessageId,
      role: "player" as const,
      speakerNationId: player.id,
      targetNationId: target.id,
      roomId,
      participantNationIds,
      sequence: 0,
      topic: decision.topic,
      intent: decision.intent,
      ...(decision.replyToMessageId === undefined
        ? {}
        : { replyToMessageId: decision.replyToMessageId }),
      turn: input.state.turn,
      date: Object.freeze({ ...input.state.date }),
      text: message,
    }),
    Object.freeze({
      id: `chat_${input.state.turn}_${offset + 1}`,
      role: "counterpart" as const,
      speakerNationId: target.id,
      targetNationId: player.id,
      roomId,
      participantNationIds,
      sequence: 1,
      topic: decision.topic,
      intent: "acknowledgement" as const,
      replyToMessageId: playerMessageId,
      turn: input.state.turn,
      date: Object.freeze({ ...input.state.date }),
      text:
        input.replyText ??
        deterministicCounterpartReply({
          state: input.state,
          targetNationId: target.id,
          decision,
        }),
    }),
  ]);
  return Object.freeze({
    ...input.state,
    chatMessages: Object.freeze([...input.state.chatMessages, ...messages]),
  });
};

export const appendIncomingCampaignChat = (
  input: AppendIncomingCampaignChatInput,
): CampaignState => {
  const message = input.message.trim();
  const speaker = input.state.nations.find((nation) => nation.id === input.speakerNationId);
  const player = input.state.nations.find((nation) => nation.id === input.state.playerNationId);
  if (
    message.length === 0 ||
    speaker === undefined ||
    player === undefined ||
    speaker.id === player.id
  ) {
    throw new RangeError("CHAT_TARGET_INVALID");
  }
  const duplicateSource = input.state.chatMessages.some(
    (entry) =>
      entry.role === "counterpart" &&
      entry.speakerNationId === speaker.id &&
      entry.sourceKey === input.sourceKey,
  );
  if (duplicateSource) {
    return input.state;
  }
  const incoming: CampaignChatMessage = Object.freeze({
    id: `chat_${input.turn}_${input.state.chatMessages.length}`,
    role: "counterpart",
    speakerNationId: speaker.id,
    targetNationId: player.id,
    roomId: campaignChatRoomId(player.id, [player.id, speaker.id], input.topic),
    participantNationIds: Object.freeze([player.id, speaker.id]),
    sequence: 1,
    topic: input.topic,
    intent: input.intent,
    sourceKey: input.sourceKey,
    turn: input.turn,
    date: Object.freeze({ ...input.state.date }),
    text: message,
  });
  return Object.freeze({
    ...input.state,
    chatMessages: Object.freeze([...input.state.chatMessages, incoming]),
  });
};
