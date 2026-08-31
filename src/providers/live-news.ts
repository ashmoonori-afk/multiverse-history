import { type NewsOutput, newsJsonSchema, parseNewsOutput } from "./news-schema";
import type { ProviderId } from "./process-runner";
import { invokeStructuredProvider, type StructuredInvocationRunner } from "./structured-invocation";

export interface LiveNewsInput {
  readonly provider: ProviderId;
  readonly orderText: string;
  readonly contextJson: string;
  readonly timeoutMs?: number;
  readonly runner?: StructuredInvocationRunner;
}

const buildNewsPrompt = (input: LiveNewsInput): string =>
  [
    "Pax Historia 한국어 신문 기사 작성",
    "CONTEXT_JSON의 확정된 결과만 기사화한다.",
    "확정되지 않은 수치, 사건, 인용을 만들지 않는다.",
    "플레이어의 원문 명령을 제목이나 본문에 그대로 복사하지 않는다.",
    "원문 명령을 실행 결과와 역사적 맥락을 설명하는 보도 문체로 바꾼다.",
    "AI, 모델, 프롬프트, JSON, 게임 시스템을 언급하지 않는다.",
    "반드시 제공된 JSON 스키마만 반환한다.",
    "CONTEXT_JSON",
    input.contextJson,
  ].join("\n");

export const authorLiveNews = (input: LiveNewsInput): Promise<NewsOutput> =>
  invokeStructuredProvider({
    provider: input.provider,
    prompt: buildNewsPrompt(input),
    jsonSchema: newsJsonSchema(),
    parse: (value) => parseNewsOutput(value, input.orderText),
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    ...(input.runner === undefined ? {} : { runner: input.runner }),
  });

export const createNewsWithLiveProvider = authorLiveNews;
