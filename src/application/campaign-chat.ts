import { z } from "zod";

import type { CampaignState } from "./campaign-state";

export interface CampaignChatMessage {
  readonly id: string;
  readonly role: "player" | "counterpart";
  readonly speakerNationId: string;
  readonly targetNationId: string;
  readonly turn: number;
  readonly date: { readonly year: number; readonly quarter: number };
  readonly text: string;
}

export const CampaignChatMessageSchema = z
  .object({
    id: z.string().regex(/^chat_[a-z0-9_]+$/),
    role: z.enum(["player", "counterpart"]),
    speakerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    targetNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
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

export interface AppendCampaignChatInput {
  readonly state: CampaignState;
  readonly targetNationId: string;
  readonly message: string;
}

const counterpartReply = (state: CampaignState, targetNationId: string): string => {
  const target = state.nations.find((nation) => nation.id === targetNationId);
  const targetName = target?.nameKo ?? targetNationId;
  return `${targetName} 외교실은 통상 협정, 관계 개선 회담, 공동 철도망 협의를 현재 협상 선택지로 제시했습니다.`;
};

export const appendCampaignChat = (input: AppendCampaignChatInput): CampaignState => {
  const message = input.message.trim();
  const player = input.state.nations.find((nation) => nation.id === input.state.playerNationId);
  const target = input.state.nations.find((nation) => nation.id === input.targetNationId);
  if (message.length === 0 || player === undefined || target === undefined) {
    throw new RangeError("CHAT_TARGET_INVALID");
  }
  const base = {
    targetNationId: target.id,
    turn: input.state.turn,
    date: Object.freeze({ ...input.state.date }),
  };
  const offset = input.state.chatMessages.length;
  const messages: readonly CampaignChatMessage[] = Object.freeze([
    Object.freeze({
      ...base,
      id: `chat_${input.state.turn}_${offset}`,
      role: "player" as const,
      speakerNationId: player.id,
      text: message,
    }),
    Object.freeze({
      ...base,
      id: `chat_${input.state.turn}_${offset + 1}`,
      role: "counterpart" as const,
      speakerNationId: target.id,
      text: counterpartReply(input.state, target.id),
    }),
  ]);
  return Object.freeze({
    ...input.state,
    chatMessages: Object.freeze([...input.state.chatMessages, ...messages]),
  });
};
