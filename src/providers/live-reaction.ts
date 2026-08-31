import type { ProviderId } from "./process-runner";
import { parseReactionOutput, type ReactionOutput, reactionJsonSchema } from "./reaction-schema";
import { invokeStructuredProvider, type StructuredInvocationRunner } from "./structured-invocation";

export interface LiveReactionInput {
  readonly provider: ProviderId;
  readonly eventJson: string;
  readonly contextJson: string;
  readonly timeoutMs?: number;
  readonly runner?: StructuredInvocationRunner;
}

const buildReactionPrompt = (input: LiveReactionInput): string =>
  [
    "Pax Historia 국가 반응 작성",
    "EVENT_JSON의 사건에 관해 CONTEXT_JSON에 등장하는 비플레이어 국가의 공식 반응을 작성한다.",
    "각 국가는 최대 한 번만 포함하고 국가 식별자는 CONTEXT_JSON의 값을 그대로 사용한다.",
    "입장과 감정 점수는 발언 내용과 일치해야 한다.",
    "확정되지 않은 사건이나 상태 변화를 만들지 않는다.",
    "AI, 모델, 프롬프트, JSON, 게임 시스템을 언급하지 않는다.",
    "반드시 제공된 JSON 스키마만 반환한다.",
    "CONTEXT_JSON",
    input.contextJson,
    "EVENT_JSON",
    input.eventJson,
  ].join("\n");

export const authorLiveReactions = (input: LiveReactionInput): Promise<ReactionOutput> =>
  invokeStructuredProvider({
    provider: input.provider,
    prompt: buildReactionPrompt(input),
    jsonSchema: reactionJsonSchema(),
    parse: parseReactionOutput,
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    ...(input.runner === undefined ? {} : { runner: input.runner }),
  });

export const createReactionsWithLiveProvider = authorLiveReactions;
