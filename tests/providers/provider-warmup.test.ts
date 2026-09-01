import { beforeEach, describe, expect, test } from "bun:test";

import { resetProviderWarmupForTests, warmUpProvider } from "../../src/providers/provider-warmup";
import type { StructuredInvocationRunner } from "../../src/providers/structured-invocation";

const successRunner = (calls: { count: number }): StructuredInvocationRunner => {
  return async () => {
    calls.count += 1;
    return {
      exitCode: 0,
      stdout: JSON.stringify({
        type: "result",
        subtype: "success",
        structured_output: { ok: true },
      }),
      stderr: "",
    };
  };
};

describe("provider warm-up", () => {
  beforeEach(() => {
    resetProviderWarmupForTests();
  });

  test("runs one warm-up invocation and dedupes repeat requests", async () => {
    const calls = { count: 0 };
    const runner = successRunner(calls);

    await Promise.all([
      warmUpProvider("claude", runner),
      warmUpProvider("claude", runner),
      warmUpProvider("claude", runner),
    ]);
    await warmUpProvider("claude", runner);

    expect(calls.count).toBe(1);
  });

  test("re-warms after a failed warm-up instead of caching the failure", async () => {
    const calls = { count: 0 };
    const failingRunner: StructuredInvocationRunner = async () => {
      calls.count += 1;
      return { exitCode: 1, stdout: "", stderr: "boom" };
    };

    await warmUpProvider("claude", failingRunner);
    await warmUpProvider("claude", successRunner(calls));

    expect(calls.count).toBe(2);
  });
});
