import { describe, expect, spyOn, test } from "bun:test";
import { z } from "zod";

import { diagnoseProvider } from "../../src/providers/diagnostics";
import { runProviderProcess } from "../../src/providers/process-runner";

describe("provider process runner", () => {
  test("runs installed provider binaries with argument arrays", async () => {
    // Given
    const timeoutMs = 15_000;

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
  }, 30_000);

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

  test("logs a correlated completion event for planner requests", async () => {
    // Given
    const info = spyOn(console, "info").mockImplementation(() => undefined);

    try {
      // When
      await runProviderProcess({
        provider: "codex",
        args: ["--version"],
        stdin: "",
        timeoutMs: 5_000,
        requestId: "req_log_success",
      });

      // Then
      expect(info).toHaveBeenCalledTimes(1);
      const event = z
        .object({
          event: z.string(),
          provider: z.string(),
          requestId: z.string(),
          durationMs: z.number(),
          exitCode: z.number(),
        })
        .passthrough()
        .parse(JSON.parse(String(info.mock.calls[0]?.[0])));
      expect(event).toEqual(
        expect.objectContaining({
          event: "provider.process.completed",
          provider: "codex",
          requestId: "req_log_success",
          exitCode: 0,
        }),
      );
      expect(event.durationMs).toBeNumber();
    } finally {
      info.mockRestore();
    }
  });

  test("logs a bounded correlated failure event for planner requests", async () => {
    // Given
    const error = spyOn(console, "error").mockImplementation(() => undefined);

    try {
      // When
      const result = await runProviderProcess({
        provider: "codex",
        args: ["--definitely-invalid-option"],
        stdin: "",
        timeoutMs: 5_000,
        requestId: "req_log_failure",
      });

      // Then
      expect(result.exitCode).not.toBe(0);
      expect(error).toHaveBeenCalledTimes(1);
      const event = z
        .object({
          event: z.string(),
          provider: z.string(),
          requestId: z.string(),
          exitCode: z.number(),
          detail: z.string(),
        })
        .passthrough()
        .parse(JSON.parse(String(error.mock.calls[0]?.[0])));
      expect(event).toEqual(
        expect.objectContaining({
          event: "provider.process.failed",
          provider: "codex",
          requestId: "req_log_failure",
          exitCode: result.exitCode,
        }),
      );
      expect(String(event.detail).length).toBeLessThanOrEqual(1_000);
    } finally {
      error.mockRestore();
    }
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
  }, 30_000);
});
