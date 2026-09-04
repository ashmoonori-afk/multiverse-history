import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import { buildClaudeArguments } from "./claude-provider";
import { buildCodexArguments } from "./codex-provider";
import type { ProviderId, ProviderProcessInput, ProviderProcessResult } from "./process-runner";
import { MAX_PROVIDER_OUTPUT_BYTES, runProviderProcess } from "./process-runner";

const DEFAULT_TIMEOUT_MS = 120_000;
const FAILURE_EXCERPT_LENGTH = 2_000;

const ClaudeEnvelopeSchema = z
  .object({
    type: z.literal("result"),
    subtype: z.literal("success"),
    result: z.unknown().optional(),
    structured_output: z.unknown().optional(),
  })
  .passthrough();

export type ProviderInvocationErrorCode =
  | "PROVIDER_CANCELLED"
  | "PROVIDER_FAILED"
  | "PROVIDER_OUTPUT_TOO_LARGE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE";

export class ProviderInvocationError extends Error {
  override readonly name = "ProviderInvocationError";

  constructor(
    readonly code: ProviderInvocationErrorCode,
    readonly detail = "",
    options?: ErrorOptions,
  ) {
    super(detail.length === 0 ? code : `${code}:${detail}`, options);
  }
}

export type StructuredInvocationRunner = (
  input: ProviderProcessInput,
  signal?: AbortSignal,
) => Promise<ProviderProcessResult>;

export interface StructuredInvocationInput<Output> {
  readonly provider: ProviderId;
  readonly requestId?: string;
  readonly prompt: string;
  readonly jsonSchema: object;
  readonly parse: (value: unknown) => Output;
  readonly timeoutMs?: number;
  readonly runner?: StructuredInvocationRunner;
}

const failureExcerpt = (result: ProviderProcessResult): string =>
  (result.stderr || result.stdout)
    .trim()
    .replaceAll(homedir(), "~")
    .slice(0, FAILURE_EXCERPT_LENGTH);

const mappedProcessError = (error: unknown): ProviderInvocationError => {
  if (error instanceof ProviderInvocationError) {
    return error;
  }
  if (error instanceof Error) {
    switch (error.message) {
      case "PROVIDER_CANCELLED":
      case "PROVIDER_OUTPUT_TOO_LARGE":
      case "PROVIDER_TIMEOUT":
        return new ProviderInvocationError(error.message, "", { cause: error });
      default:
        return new ProviderInvocationError("PROVIDER_UNAVAILABLE", "", { cause: error });
    }
  }
  return new ProviderInvocationError("PROVIDER_UNAVAILABLE");
};

const runProcess = async (
  runner: StructuredInvocationRunner,
  input: ProviderProcessInput,
): Promise<ProviderProcessResult> => {
  try {
    return await runner(input, AbortSignal.timeout(input.timeoutMs + 5_000));
  } catch (error: unknown) {
    throw mappedProcessError(error);
  }
};

const decodeJson = (value: string): unknown => {
  if (value.trim().length === 0) {
    throw new TypeError("PROVIDER_EMPTY_OUTPUT");
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new TypeError("PROVIDER_MALFORMED_OUTPUT");
  }
};

const decodeClaudeOutput = (stdout: string): unknown => {
  const envelope = ClaudeEnvelopeSchema.parse(decodeJson(stdout));
  const output = envelope.structured_output ?? envelope.result;
  if (output === undefined) {
    throw new TypeError("PROVIDER_EMPTY_OUTPUT");
  }
  return typeof output === "string" ? decodeJson(output) : output;
};

const readCodexResult = async (path: string): Promise<string> => {
  try {
    const handle = await open(path, "r");
    try {
      if ((await handle.stat()).size > MAX_PROVIDER_OUTPUT_BYTES) {
        throw new ProviderInvocationError("PROVIDER_OUTPUT_TOO_LARGE");
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      while (bytes <= MAX_PROVIDER_OUTPUT_BYTES) {
        const chunk = Buffer.allocUnsafe(
          Math.min(64 * 1024, MAX_PROVIDER_OUTPUT_BYTES + 1 - bytes),
        );
        const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
        if (bytesRead === 0) break;
        bytes += bytesRead;
        if (bytes > MAX_PROVIDER_OUTPUT_BYTES) {
          throw new ProviderInvocationError("PROVIDER_OUTPUT_TOO_LARGE");
        }
        chunks.push(chunk.subarray(0, bytesRead));
      }
      return Buffer.concat(chunks, bytes).toString("utf8");
    } finally {
      await handle.close();
    }
  } catch (error: unknown) {
    throw mappedProcessError(error);
  }
};

const providerOutput = async (
  input: StructuredInvocationInput<unknown>,
  workspace: string,
  timeoutMs: number,
): Promise<unknown> => {
  const schemaJson = JSON.stringify(input.jsonSchema);
  const resultPath = join(workspace, "result.json");
  const schemaPath = join(workspace, "output.schema.json");
  if (input.provider === "codex") {
    await writeFile(schemaPath, schemaJson, "utf8");
  }
  const args =
    input.provider === "codex"
      ? buildCodexArguments({ schemaPath, resultPath })
      : buildClaudeArguments(schemaJson);
  const result = await runProcess(input.runner ?? runProviderProcess, {
    provider: input.provider,
    args,
    stdin: input.prompt,
    timeoutMs,
    cwd: workspace,
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
  });
  if (result.exitCode !== 0) {
    throw new ProviderInvocationError("PROVIDER_FAILED", failureExcerpt(result));
  }
  return input.provider === "codex"
    ? decodeJson(await readCodexResult(resultPath))
    : decodeClaudeOutput(result.stdout);
};

export const invokeStructuredProvider = async <Output>(
  input: StructuredInvocationInput<Output>,
): Promise<Output> => {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("Provider timeout must be a positive safe integer");
  }
  const workspace = await mkdtemp(join(tmpdir(), `pax-historia-${input.provider}-`));
  try {
    return input.parse(await providerOutput(input, workspace, timeoutMs));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
};
