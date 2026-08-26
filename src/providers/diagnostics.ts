import type { ProviderId } from "./process-runner";
import { runProviderProcess } from "./process-runner";

export interface ProviderDiagnostic {
  readonly provider: ProviderId;
  readonly detectedVersion: string;
  readonly authenticated: boolean;
  readonly available: boolean;
  readonly code: "ok" | "not_found" | "auth_required" | "timeout" | "failed";
  readonly redactedDetail: string;
}

const diagnosticArguments = (
  provider: ProviderId,
): {
  readonly version: readonly string[];
  readonly auth: readonly string[];
} =>
  provider === "codex"
    ? { version: ["--version"], auth: ["login", "status"] }
    : { version: ["--version"], auth: ["auth", "status"] };

const failureDiagnostic = (provider: ProviderId, error: unknown): ProviderDiagnostic => {
  const detail = error instanceof Error ? error.message : "unknown";
  const code =
    detail === "PROVIDER_TIMEOUT" ? "timeout" : detail.includes("ENOENT") ? "not_found" : "failed";
  return Object.freeze({
    provider,
    detectedVersion: "",
    authenticated: false,
    available: false,
    code,
    redactedDetail: code,
  });
};

export const diagnoseProvider = async (
  provider: ProviderId,
  signal?: AbortSignal,
): Promise<ProviderDiagnostic> => {
  const args = diagnosticArguments(provider);
  try {
    const [version, auth] = await Promise.all([
      runProviderProcess({ provider, args: args.version, stdin: "", timeoutMs: 5_000 }, signal),
      runProviderProcess({ provider, args: args.auth, stdin: "", timeoutMs: 10_000 }, signal),
    ]);
    const authenticated = auth.exitCode === 0;
    return Object.freeze({
      provider,
      detectedVersion: (version.stdout || version.stderr).trim(),
      authenticated,
      available: version.exitCode === 0 && authenticated,
      code: authenticated ? "ok" : "auth_required",
      redactedDetail: authenticated ? "ok" : "auth_required",
    });
  } catch (error) {
    return failureDiagnostic(provider, error);
  }
};
