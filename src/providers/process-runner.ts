import { spawn } from "node:child_process";
import { homedir } from "node:os";

export type ProviderId = "codex" | "claude";

export interface ProviderProcessInput {
  readonly provider: ProviderId;
  readonly args: readonly string[];
  readonly stdin: string;
  readonly timeoutMs: number;
  readonly cwd?: string;
  readonly requestId?: string;
}

export interface ProviderProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_LOG_DETAIL_LENGTH = 1_000;
const environmentKeys = [
  "PATH",
  "SystemRoot",
  "WINDIR",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
] as const;

const sanitizedEnvironment = (): NodeJS.ProcessEnv => {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of environmentKeys) {
    const value = process.env[key];
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  return environment;
};

const processError = (code: string): Error => new Error(code);

const logDetail = (stderr: string, stdout: string): string =>
  (stderr || stdout)
    .trim()
    .replaceAll(homedir(), "~")
    .replaceAll(/\s+/g, " ")
    .slice(0, MAX_LOG_DETAIL_LENGTH);

type ProviderLogInput =
  | {
      readonly status: "completed";
      readonly process: ProviderProcessInput;
      readonly durationMs: number;
      readonly exitCode: number;
    }
  | {
      readonly status: "failed";
      readonly process: ProviderProcessInput;
      readonly durationMs: number;
      readonly exitCode: number | null;
      readonly failureCode: string;
      readonly detail: string;
    };

const logProviderEvent = (input: ProviderLogInput): void => {
  const requestId = input.process.requestId;
  if (requestId === undefined) {
    return;
  }
  switch (input.status) {
    case "completed":
      console.info(
        JSON.stringify({
          event: "provider.process.completed",
          provider: input.process.provider,
          requestId,
          durationMs: input.durationMs,
          exitCode: input.exitCode,
        }),
      );
      return;
    case "failed":
      console.error(
        JSON.stringify({
          event: "provider.process.failed",
          provider: input.process.provider,
          requestId,
          durationMs: input.durationMs,
          exitCode: input.exitCode,
          failureCode: input.failureCode,
          detail: input.detail,
        }),
      );
  }
};

const terminateProcessTree = (pid: number | undefined): void => {
  if (pid === undefined) {
    return;
  }
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      shell: false,
      windowsHide: true,
      stdio: "ignore",
    });
    killer.once("error", () => {
      process.kill(pid);
    });
    return;
  }
  process.kill(-pid, "SIGTERM");
};

export const runProviderProcess = (
  input: ProviderProcessInput,
  signal?: AbortSignal,
): Promise<ProviderProcessResult> => {
  if (signal?.aborted === true) {
    return Promise.reject(processError("PROVIDER_CANCELLED"));
  }
  if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs <= 0) {
    return Promise.reject(new RangeError("Provider timeout must be a positive safe integer"));
  }
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const child = spawn(input.provider, [...input.args], {
      cwd: input.cwd,
      detached: process.platform !== "win32",
      env: sanitizedEnvironment(),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let failureCode: string | undefined;

    const failAndTerminate = (code: string): void => {
      failureCode ??= code;
      terminateProcessTree(child.pid);
    };
    const appendOutput = (target: Buffer[], chunk: Buffer): void => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        failAndTerminate("PROVIDER_OUTPUT_TOO_LARGE");
        return;
      }
      target.push(chunk);
    };
    const abort = (): void => failAndTerminate("PROVIDER_CANCELLED");
    const timer = setTimeout(() => failAndTerminate("PROVIDER_TIMEOUT"), input.timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    const durationMs = (): number => Math.round(performance.now() - startedAt);

    child.stdout.on("data", (chunk: Buffer) => appendOutput(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => appendOutput(stderr, chunk));
    child.once("error", (error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      logProviderEvent({
        status: "failed",
        process: input,
        durationMs: durationMs(),
        exitCode: null,
        failureCode: "PROVIDER_UNAVAILABLE",
        detail: logDetail(error.message, ""),
      });
      reject(error);
    });
    child.once("exit", (exitCode) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (failureCode !== undefined) {
        logProviderEvent({
          status: "failed",
          process: input,
          durationMs: durationMs(),
          exitCode,
          failureCode,
          detail: logDetail(
            Buffer.concat(stderr).toString("utf8"),
            Buffer.concat(stdout).toString("utf8"),
          ),
        });
        reject(processError(failureCode));
        return;
      }
      const result = Object.freeze({
        exitCode: exitCode ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
      if (result.exitCode === 0) {
        logProviderEvent({
          status: "completed",
          process: input,
          durationMs: durationMs(),
          exitCode: result.exitCode,
        });
      } else {
        logProviderEvent({
          status: "failed",
          process: input,
          durationMs: durationMs(),
          exitCode: result.exitCode,
          failureCode: "PROVIDER_FAILED",
          detail: logDetail(result.stderr, result.stdout),
        });
      }
      resolve(result);
    });
    child.stdin.end(input.stdin);
  });
};
