import {
  type CampaignChatDecision,
  type CampaignChatMessage,
  campaignChatRoomId,
  classifyCampaignChatMessage,
} from "./campaign-chat";
import type { CampaignState } from "./campaign-state";

export interface CampaignGroupChatResponderInput {
  readonly state: CampaignState;
  readonly targetNationId: string;
  readonly participantNationIds: readonly string[];
  readonly message: string;
  readonly decision: CampaignChatDecision;
}

export type CampaignGroupChatResponder = (
  input: CampaignGroupChatResponderInput,
) => Promise<string>;

export interface ExecuteCampaignGroupChatInput {
  readonly state: CampaignState;
  readonly targetNationIds: readonly string[];
  readonly message: string;
  readonly responder: CampaignGroupChatResponder;
}

interface PreparedReply {
  readonly targetNationId: string;
  readonly decision: CampaignChatDecision;
  readonly text: string;
}

const validTargets = (
  state: CampaignState,
  targetNationIds: readonly string[],
): readonly string[] => {
  if (
    targetNationIds.length < 1 ||
    targetNationIds.length > 8 ||
    new Set(targetNationIds).size !== targetNationIds.length ||
    targetNationIds.includes(state.playerNationId)
  ) {
    throw new RangeError("CHAT_TARGET_INVALID");
  }
  const nationIds = new Set<string>(state.nations.map((nation) => nation.id));
  if (targetNationIds.some((nationId) => !nationIds.has(nationId))) {
    throw new RangeError("CHAT_TARGET_INVALID");
  }
  return Object.freeze([...targetNationIds]);
};

const buildMessages = (
  state: CampaignState,
  participantNationIds: readonly string[],
  message: string,
  replies: readonly PreparedReply[],
): readonly CampaignChatMessage[] => {
  const firstReply = replies[0];
  if (firstReply === undefined) {
    throw new RangeError("CHAT_TARGET_INVALID");
  }
  const offset = state.chatMessages.length;
  const playerMessageId = `chat_${state.turn}_${offset}`;
  const roomId = campaignChatRoomId(
    state.playerNationId,
    participantNationIds,
    firstReply.decision.topic,
  );
  const playerMessage: CampaignChatMessage = Object.freeze({
    id: playerMessageId,
    role: "player",
    speakerNationId: state.playerNationId,
    targetNationId: firstReply.targetNationId,
    roomId,
    participantNationIds,
    sequence: 0,
    topic: firstReply.decision.topic,
    intent: firstReply.decision.intent,
    ...(firstReply.decision.replyToMessageId === undefined
      ? {}
      : { replyToMessageId: firstReply.decision.replyToMessageId }),
    turn: state.turn,
    date: Object.freeze({ ...state.date }),
    text: message,
  });
  const counterpartMessages = replies.map(
    (reply, index): CampaignChatMessage =>
      Object.freeze({
        id: `chat_${state.turn}_${offset + index + 1}`,
        role: "counterpart",
        speakerNationId: reply.targetNationId,
        targetNationId: state.playerNationId,
        roomId,
        participantNationIds,
        sequence: index + 1,
        topic: firstReply.decision.topic,
        intent: "acknowledgement",
        replyToMessageId: playerMessageId,
        turn: state.turn,
        date: Object.freeze({ ...state.date }),
        text: reply.text,
      }),
  );
  return Object.freeze([playerMessage, ...counterpartMessages]);
};

export const executeCampaignGroupChat = async (
  input: ExecuteCampaignGroupChatInput,
): Promise<CampaignState> => {
  const message = input.message.trim();
  if (message.length === 0) {
    throw new RangeError("CHAT_TARGET_INVALID");
  }
  const targetNationIds = validTargets(input.state, input.targetNationIds);
  const participantNationIds = Object.freeze([input.state.playerNationId, ...targetNationIds]);
  const replies: PreparedReply[] = [];
  for (const targetNationId of targetNationIds) {
    const decision = classifyCampaignChatMessage({
      state: input.state,
      targetNationId,
      message,
    });
    const text = (
      await input.responder({
        state: input.state,
        targetNationId,
        participantNationIds,
        message,
        decision,
      })
    ).trim();
    if (text.length === 0) {
      throw new TypeError("PROVIDER_EMPTY_OUTPUT");
    }
    replies.push(Object.freeze({ targetNationId, decision, text }));
  }
  const messages = buildMessages(input.state, participantNationIds, message, replies);
  return Object.freeze({
    ...input.state,
    chatMessages: Object.freeze([...input.state.chatMessages, ...messages]),
  });
};
