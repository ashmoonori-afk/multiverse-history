import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { buildClaudeArguments, parseClaudeEnvelope } from "./claude-provider";
import { buildCodexArguments, parseCodexLastMessage } from "./codex-provider";
import { runProviderProcess } from "./process-runner";
import { buildProviderPrompt } from "./prompt";
import type { StrategicPlan } from "./schemas";
import { strategicPlanJsonSchema } from "./schemas";

export interface LivePlannerInput {
  readonly provider: "codex" | "claude";
  readonly requestId: string;
  readonly orderText: string;
  readonly stateJson: string;
  readonly timeoutMs?: number;
  readonly nationCount?: number;
}

const schemaJson = JSON.stringify(strategicPlanJsonSchema());

const failureExcerpt = (stderr: string, stdout: string): string =>
  (stderr || stdout).trim().replaceAll(homedir(), "~").slice(0, 2_000);

interface RunLiveProviderInput {
  readonly workspace: string;
  readonly prompt: string;
  readonly timeoutMs: number;
  readonly requestId: string;
}

const runCodex = async (input: RunLiveProviderInput): Promise<StrategicPlan> => {
  const schemaPath = join(input.workspace, "strategic-plan.schema.json");
  const resultPath = join(input.workspace, "result.json");
  await writeFile(schemaPath, schemaJson, "utf8");
  const result = await runProviderProcess(
    {
      provider: "codex",
      args: buildCodexArguments({ schemaPath, resultPath }),
      stdin: input.prompt,
      timeoutMs: input.timeoutMs,
      cwd: input.workspace,
      requestId: input.requestId,
    },
    AbortSignal.timeout(input.timeoutMs + 5_000),
  );
  if (result.exitCode !== 0) {
    throw new Error(`PROVIDER_FAILED:${failureExcerpt(result.stderr, result.stdout)}`);
  }
  return parseCodexLastMessage(await readFile(resultPath, "utf8"));
};

const runClaude = async (input: RunLiveProviderInput): Promise<StrategicPlan> => {
  const result = await runProviderProcess(
    {
      provider: "claude",
      args: buildClaudeArguments(schemaJson),
      stdin: input.prompt,
      timeoutMs: input.timeoutMs,
      cwd: input.workspace,
      requestId: input.requestId,
    },
    AbortSignal.timeout(input.timeoutMs + 5_000),
  );
  if (result.exitCode !== 0) {
    throw new Error(`PROVIDER_FAILED:${failureExcerpt(result.stderr, result.stdout)}`);
  }
  return parseClaudeEnvelope(result.stdout);
};

export const planWithLiveProvider = async (input: LivePlannerInput): Promise<StrategicPlan> => {
  const timeoutMs = input.timeoutMs ?? 120_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("Provider timeout must be a positive safe integer");
  }
  const workspace = await mkdtemp(join(tmpdir(), `multiverse-history-${input.provider}-`));
  const prompt = buildProviderPrompt({
    requestId: input.requestId,
    orderText: input.orderText,
    stateJson: input.stateJson,
    ...(input.nationCount === undefined ? {} : { nationCount: input.nationCount }),
  });
  try {
    const runInput = { workspace, prompt, timeoutMs, requestId: input.requestId };
    return input.provider === "codex" ? await runCodex(runInput) : await runClaude(runInput);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
};
