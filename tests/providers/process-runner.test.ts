import { describe, expect, test } from "bun:test";

import { diagnoseProvider } from "../../src/providers/diagnostics";
import { runProviderProcess } from "../../src/providers/process-runner";

describe("provider process runner", () => {
  test("runs installed provider binaries with argument arrays", async () => {
    // Given
    const timeoutMs = 5_000;

    // When
    const [codex, claude] = await Promise.all([
      runProviderProcess({ provider: "codex", args: ["--version"], stdin: "", timeoutMs }),
      runProviderProcess({ provider: "claude", args: ["--version"], stdin: "", timeoutMs }),
    ]);

    // Then
    expect(codex.exitCode).toBe(0);
    expect(codex.stdout).toContain("codex-cli");
    expect(claude.exitCode).toBe(0);
    expect(claude.stdout).toContain("Claude Code");
  });

  test("rejects an already-aborted invocation without spawning", async () => {
    // Given
    const controller = new AbortController();
    controller.abort();

    // When
    const invocation = runProviderProcess(
      { provider: "codex", args: ["--version"], stdin: "", timeoutMs: 5_000 },
      controller.signal,
    );

    // Then
    expect(invocation).rejects.toThrow("PROVIDER_CANCELLED");
  });

  test("reports both subscription CLIs available and authenticated", async () => {
    // Given
    const signal = AbortSignal.timeout(15_000);

    // When
    const [codex, claude] = await Promise.all([
      diagnoseProvider("codex", signal),
      diagnoseProvider("claude", signal),
    ]);

    // Then
    expect(codex.available).toBe(true);
    expect(codex.authenticated).toBe(true);
    expect(claude.available).toBe(true);
    expect(claude.authenticated).toBe(true);
  });
});
