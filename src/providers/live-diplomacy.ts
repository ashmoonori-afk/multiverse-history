import type { CampaignChatDecision } from "../application/campaign-chat";
import {
  type GroupChatOutput,
  groupChatJsonSchema,
  parseGroupChatOutput,
} from "./group-chat-schema";
import type { ProviderId } from "./process-runner";
import { invokeStructuredProvider, type StructuredInvocationRunner } from "./structured-invocation";

export interface LiveDiplomacyInput {
  readonly provider: ProviderId;
  readonly playerNationName: string;
  readonly targetNationName: string;
  readonly roomParticipantNationNames?: readonly string[];
  readonly playerMessage: string;
  readonly decision: CampaignChatDecision;
  readonly stateJson: string;
  readonly timeoutMs?: number;
  readonly runner?: StructuredInvocationRunner;
}

export interface LiveGroupDiplomacyInput extends LiveDiplomacyInput {
  readonly participantNationNames: readonly string[];
}

const buildDiplomacyPrompt = (
  input: LiveDiplomacyInput,
  speakingNationNames: readonly string[],
): string =>
  [
    "Pax Historia 외교 역할극",
    `당신은 ${speakingNationNames.join(", ")}의 외교 책임자들이다.`,
    `대화방 전체 참가국: ${(input.roomParticipantNationNames ?? speakingNationNames).join(", ")}`,
    `${input.playerNationName}의 플레이어와 국가 대 국가로 대화한다.`,
    "최근 사건, 조약, 관계, 전체 대화 기록과 국가 식별자는 STATE_JSON에 있다.",
    "각 reply의 speakerNationId는 해당 발언국의 STATE_JSON 식별자를 사용한다.",
    "참가국이 하나면 답변 하나만 작성한다. 여러 참가국이면 필요한 국가만 순서대로 답한다.",
    "마지막 플레이어 메시지에 직접 답하고 앞선 대화와 모순되지 않게 행동한다.",
    "플레이어가 거절하면 거절을 인정하고 같은 제안을 목록처럼 반복하지 않는다.",
    "플레이어가 질문하면 현재 상태에 근거한 구체적인 조건을 답한다.",
    "AI, 모델, 프롬프트, JSON, 게임 시스템을 언급하지 않는다.",
    "각 발언은 한국어 1~3문장으로 자연스럽게 작성한다.",
    "반드시 제공된 JSON 스키마만 반환한다.",
    `분류된 주제: ${input.decision.topic}`,
    `분류된 의도: ${input.decision.intent}`,
    "STATE_JSON",
    input.stateJson,
    "BEGIN_UNTRUSTED_PLAYER_MESSAGE",
    input.playerMessage,
    "END_UNTRUSTED_PLAYER_MESSAGE",
  ].join("\n");

const invokeDiplomacy = (
  input: LiveDiplomacyInput,
  participantNationNames: readonly string[],
): Promise<GroupChatOutput> =>
  invokeStructuredProvider({
    provider: input.provider,
    prompt: buildDiplomacyPrompt(input, participantNationNames),
    jsonSchema: groupChatJsonSchema(),
    parse: parseGroupChatOutput,
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    ...(input.runner === undefined ? {} : { runner: input.runner }),
  });

export const respondWithLiveGroupDiplomacy = (
  input: LiveGroupDiplomacyInput,
): Promise<GroupChatOutput> => invokeDiplomacy(input, input.participantNationNames);

export const respondWithLiveDiplomacy = async (input: LiveDiplomacyInput): Promise<string> => {
  const output = await invokeDiplomacy(input, [input.targetNationName]);
  const firstReply = output.replies[0];
  if (firstReply === undefined) {
    throw new TypeError("PROVIDER_EMPTY_OUTPUT");
  }
  return firstReply.textKo;
};
