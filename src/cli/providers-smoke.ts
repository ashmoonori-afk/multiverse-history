import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { buildClaudeArguments, parseClaudeEnvelope } from "../providers/claude-provider";
import { buildCodexArguments, parseCodexLastMessage } from "../providers/codex-provider";
import { runProviderProcess } from "../providers/process-runner";
import { buildProviderPrompt } from "../providers/prompt";
import type { StrategicPlan } from "../providers/schemas";
import { strategicPlanJsonSchema } from "../providers/schemas";

const providerArgument = process.argv.indexOf("--provider");
const provider = process.argv[providerArgument + 1];
if (provider !== "codex" && provider !== "claude") {
  throw new RangeError("Usage: bun run providers:smoke -- --provider codex|claude");
}

const schemaJson = JSON.stringify(strategicPlanJsonSchema());
const prompt = buildProviderPrompt({
  requestId: "req_smoke_00000001",
  orderText: "철도망을 확장하고 일본에 통상 협정을 제안한다",
  stateJson: JSON.stringify({
    turn: 0,
    playerNationId: "nat_kor",
    validNationIds: ["nat_kor", "nat_jpn", "nat_qing", "nat_rus"],
    validProvinceIds: ["prv_kor_hanseong", "prv_jpn_kanto", "prv_qing_zhili", "prv_rus_primorye"],
  }),
});

const failureExcerpt = (stderr: string, stdout: string): string =>
  (stderr || stdout).trim().replaceAll(homedir(), "~").slice(0, 2_000);

const runCodex = async (workspace: string): Promise<StrategicPlan> => {
  const schemaPath = join(workspace, "strategic-plan.schema.json");
  const resultPath = join(workspace, "result.json");
  await writeFile(schemaPath, schemaJson, "utf8");
  const result = await runProviderProcess(
    {
      provider: "codex",
      args: buildCodexArguments({ schemaPath, resultPath }),
      stdin: prompt,
      timeoutMs: 120_000,
      cwd: workspace,
    },
    AbortSignal.timeout(125_000),
  );
  if (result.exitCode !== 0) {
    throw new Error(`PROVIDER_FAILED:${failureExcerpt(result.stderr, result.stdout)}`);
  }
  return parseCodexLastMessage(await readFile(resultPath, "utf8"));
};

const runClaude = async (workspace: string): Promise<StrategicPlan> => {
  const result = await runProviderProcess(
    {
      provider: "claude",
      args: buildClaudeArguments(schemaJson),
      stdin: prompt,
      timeoutMs: 120_000,
      cwd: workspace,
    },
    AbortSignal.timeout(125_000),
  );
  if (result.exitCode !== 0) {
    throw new Error(`PROVIDER_FAILED:${failureExcerpt(result.stderr, result.stdout)}`);
  }
  return parseClaudeEnvelope(result.stdout);
};

const workspace = await mkdtemp(join(tmpdir(), `multiverse-history-${provider}-`));
try {
  const plan = provider === "codex" ? await runCodex(workspace) : await runClaude(workspace);
  console.log(JSON.stringify({ provider, status: "ok", plan }, null, 2));
} finally {
  await rm(workspace, { recursive: true, force: true });
}
