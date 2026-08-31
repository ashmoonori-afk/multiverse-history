import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import type { CampaignChatDecision } from "../application/campaign-chat";
import { buildClaudeArguments } from "./claude-provider";
import { buildCodexArguments } from "./codex-provider";
import { runProviderProcess } from "./process-runner";

export interface LiveDiplomacyInput {
  readonly provider: "codex" | "claude";
  readonly playerNationName: string;
  readonly targetNationName: string;
  readonly playerMessage: string;
  readonly decision: CampaignChatDecision;
  readonly stateJson: string;
  readonly timeoutMs?: number;
}

interface DiplomacyReply {
  readonly replyKo: string;
}

const DiplomacyReplySchema = z
  .object({
    replyKo: z.string().trim().min(1).max(1_200),
  })
  .strict()
  .readonly();

const ClaudeEnvelopeSchema = z
  .object({
    type: z.literal("result"),
    subtype: z.literal("success"),
    result: z.unknown().optional(),
    structured_output: z.unknown().optional(),
  })
  .passthrough();

const diplomacyReplyJsonSchema = Object.freeze({
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    replyKo: { type: "string", minLength: 1, maxLength: 1_200 },
  },
  required: ["replyKo"],
  additionalProperties: false,
});

const failureExcerpt = (stderr: string, stdout: string): string =>
  (stderr || stdout).trim().replaceAll(homedir(), "~").slice(0, 2_000);

const decodeReply = (value: unknown): DiplomacyReply => {
  if (typeof value !== "string") {
    return DiplomacyReplySchema.parse(value);
  }
  if (value.trim().length === 0) {
    throw new TypeError("PROVIDER_EMPTY_OUTPUT");
  }
  try {
    return DiplomacyReplySchema.parse(JSON.parse(value));
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw error;
    }
    throw new TypeError("PROVIDER_MALFORMED_OUTPUT");
  }
};

const parseClaudeReply = (value: string): DiplomacyReply => {
  if (value.trim().length === 0) {
    throw new TypeError("PROVIDER_EMPTY_OUTPUT");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    throw new TypeError("PROVIDER_MALFORMED_OUTPUT");
  }
  const envelope = ClaudeEnvelopeSchema.parse(decoded);
  const result = envelope.structured_output ?? envelope.result;
  if (result === undefined) {
    throw new TypeError("PROVIDER_EMPTY_OUTPUT");
  }
  return decodeReply(result);
};

const buildDiplomacyPrompt = (input: LiveDiplomacyInput): string =>
  [
    "Multiverse History 외교 역할극",
    `당신은 ${input.targetNationName}의 외교 책임자다.`,
    `${input.playerNationName}의 플레이어와 국가 대 국가로 대화한다.`,
    "최근 사건, 조약, 관계, 전체 대화 기록은 STATE_JSON에 있다.",
    "마지막 플레이어 메시지에 직접 답하고 앞선 대화와 모순되지 않게 행동한다.",
    "플레이어가 거절하면 거절을 인정하고 같은 제안을 목록처럼 반복하지 않는다.",
    "플레이어가 질문하면 현재 상태에 근거한 구체적인 조건을 답한다.",
    "AI, 모델, 프롬프트, JSON, 게임 시스템을 언급하지 않는다.",
    "한국어 1~3문장으로 자연스럽게 답한다.",
    "반드시 제공된 JSON 스키마만 반환한다.",
    `분류된 주제: ${input.decision.topic}`,
    `분류된 의도: ${input.decision.intent}`,
    "STATE_JSON",
    input.stateJson,
    "BEGIN_UNTRUSTED_PLAYER_MESSAGE",
    input.playerMessage,
    "END_UNTRUSTED_PLAYER_MESSAGE",
  ].join("\n");

const runCodex = async (
  workspace: string,
  prompt: string,
  timeoutMs: number,
): Promise<DiplomacyReply> => {
  const schemaPath = join(workspace, "diplomacy-reply.schema.json");
  const resultPath = join(workspace, "result.json");
  await writeFile(schemaPath, JSON.stringify(diplomacyReplyJsonSchema), "utf8");
  const result = await runProviderProcess(
    {
      provider: "codex",
      args: buildCodexArguments({ schemaPath, resultPath }),
      stdin: prompt,
      timeoutMs,
      cwd: workspace,
    },
    AbortSignal.timeout(timeoutMs + 5_000),
  );
  if (result.exitCode !== 0) {
    throw new Error(`PROVIDER_FAILED:${failureExcerpt(result.stderr, result.stdout)}`);
  }
  return decodeReply(await readFile(resultPath, "utf8"));
};

const runClaude = async (
  workspace: string,
  prompt: string,
  timeoutMs: number,
): Promise<DiplomacyReply> => {
  const result = await runProviderProcess(
    {
      provider: "claude",
      args: buildClaudeArguments(JSON.stringify(diplomacyReplyJsonSchema)),
      stdin: prompt,
      timeoutMs,
      cwd: workspace,
    },
    AbortSignal.timeout(timeoutMs + 5_000),
  );
  if (result.exitCode !== 0) {
    throw new Error(`PROVIDER_FAILED:${failureExcerpt(result.stderr, result.stdout)}`);
  }
  return parseClaudeReply(result.stdout);
};

export const respondWithLiveDiplomacy = async (input: LiveDiplomacyInput): Promise<string> => {
  const timeoutMs = input.timeoutMs ?? 120_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("Provider timeout must be a positive safe integer");
  }
  const workspace = await mkdtemp(join(tmpdir(), `multiverse-diplomacy-${input.provider}-`));
  const prompt = buildDiplomacyPrompt(input);
  try {
    const reply =
      input.provider === "codex"
        ? await runCodex(workspace, prompt, timeoutMs)
        : await runClaude(workspace, prompt, timeoutMs);
    return reply.replyKo;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
};
