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

const runCodex = async (
  workspace: string,
  prompt: string,
  timeoutMs: number,
): Promise<StrategicPlan> => {
  const schemaPath = join(workspace, "strategic-plan.schema.json");
  const resultPath = join(workspace, "result.json");
  await writeFile(schemaPath, schemaJson, "utf8");
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
  return parseCodexLastMessage(await readFile(resultPath, "utf8"));
};

const runClaude = async (
  workspace: string,
  prompt: string,
  timeoutMs: number,
): Promise<StrategicPlan> => {
  const result = await runProviderProcess(
    {
      provider: "claude",
      args: buildClaudeArguments(schemaJson),
      stdin: prompt,
      timeoutMs,
      cwd: workspace,
    },
    AbortSignal.timeout(timeoutMs + 5_000),
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
    return input.provider === "codex"
      ? await runCodex(workspace, prompt, timeoutMs)
      : await runClaude(workspace, prompt, timeoutMs);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
};
