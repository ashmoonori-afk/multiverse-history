import { z } from "zod";

import type { ProviderId } from "./process-runner";
import {
  parseReactionOutputForNation,
  type ReactionOutput,
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
