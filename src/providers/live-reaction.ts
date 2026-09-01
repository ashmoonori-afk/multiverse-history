import { z } from "zod";

import type { ProviderId } from "./process-runner";
import {
  parseReactionOutput,
  parseReactionOutputForNation,
  type ReactionOutput,
  reactionJsonSchema,
  reactionJsonSchemaForNation,
} from "./reaction-schema";
import { invokeStructuredProvider, type StructuredInvocationRunner } from "./structured-invocation";

export interface LiveReactionInput {
  readonly provider: ProviderId;
  readonly eventJson: string;
  readonly contextJson: string;
  readonly timeoutMs?: number;
  readonly runner?: StructuredInvocationRunner;
}

const ReactionContextSchema = z
  .object({
    reactingNation: z
      .object({
        id: z.string().regex(/^nat_[a-z0-9_]+$/),
        nameKo: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

const requestedNation = (
  contextJson: string,
): {
  readonly id: string;
  readonly nameKo: string;
} => {
  let decoded: unknown;
  try {
    decoded = JSON.parse(contextJson);
  } catch {
    throw new TypeError("PROVIDER_REACTION_CONTEXT_INVALID");
  }
  return ReactionContextSchema.parse(decoded).reactingNation;
};

const buildReactionPrompt = (
  input: LiveReactionInput,
  nation: { readonly id: string; readonly nameKo: string },
): string =>
  [
    "Pax Historia 국가 반응 작성",
    `반응 주체는 오직 ${nation.id} (${nation.nameKo})이다.`,
    "reactions 배열에는 이 국가의 공식 반응을 정확히 하나만 작성한다.",
    `nationId는 반드시 ${nation.id}와 정확히 같아야 한다.`,
    "입장과 감정 점수는 발언 내용과 일치해야 한다.",
    "확정되지 않은 사건이나 상태 변화를 만들지 않는다.",
    "AI, 모델, 프롬프트, JSON, 게임 시스템을 언급하지 않는다.",
    "반드시 제공된 JSON 스키마만 반환한다.",
    "CONTEXT_JSON",
    input.contextJson,
    "EVENT_JSON",
    input.eventJson,
  ].join("\n");

export interface LiveReactionBatchInput {
  readonly provider: ProviderId;
  readonly eventJson: string;
  readonly contextJson: string;
  readonly nations: readonly { readonly id: string; readonly nameKo: string }[];
  readonly timeoutMs?: number;
  readonly runner?: StructuredInvocationRunner;
}

const buildBatchReactionPrompt = (input: LiveReactionBatchInput): string =>
  [
    "Pax Historia 국가 반응 작성",
    `반응 주체는 다음 ${input.nations.length}개국이다. reactions 배열에 각 국가의 공식 반응을 정확히 하나씩, 아래 순서대로 작성한다:`,
    ...input.nations.map((nation) => `- ${nation.id} (${nation.nameKo})`),
    "각 반응의 nationId는 위 식별자와 정확히 같아야 하며, 목록에 없는 국가를 추가하지 않는다.",
    "각 국가의 이해관계와 성향에 맞는 서로 다른 입장을 작성한다.",
    "입장과 감정 점수는 발언 내용과 일치해야 한다.",
    "확정되지 않은 사건이나 상태 변화를 만들지 않는다.",
    "AI, 모델, 프롬프트, JSON, 게임 시스템을 언급하지 않는다.",
    "반드시 제공된 JSON 스키마만 반환한다.",
    "CONTEXT_JSON",
    input.contextJson,
    "EVENT_JSON",
    input.eventJson,
  ].join("\n");

/** One structured invocation answers for every affected nation at once. */
export const authorLiveReactionsBatch = (input: LiveReactionBatchInput): Promise<ReactionOutput> =>
  invokeStructuredProvider({
    provider: input.provider,
    prompt: buildBatchReactionPrompt(input),
    jsonSchema: reactionJsonSchema(),
    parse: parseReactionOutput,
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    ...(input.runner === undefined ? {} : { runner: input.runner }),
  });

export const authorLiveReactions = (input: LiveReactionInput): Promise<ReactionOutput> => {
  const nation = requestedNation(input.contextJson);
  return invokeStructuredProvider({
    provider: input.provider,
    prompt: buildReactionPrompt(input, nation),
    jsonSchema: reactionJsonSchemaForNation(nation.id),
    parse: (value) => parseReactionOutputForNation(value, nation.id),
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    ...(input.runner === undefined ? {} : { runner: input.runner }),
  });
};

export const createReactionsWithLiveProvider = authorLiveReactions;
