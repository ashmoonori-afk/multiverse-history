import { describe, expect, test } from "bun:test";
import { exists, truncate, writeFile } from "node:fs/promises";

import type {
  ProviderProcessInput,
  ProviderProcessResult,
} from "../../src/providers/process-runner";
import { MAX_PROVIDER_OUTPUT_BYTES } from "../../src/providers/process-runner";
import {
  invokeStructuredProvider,
  type StructuredInvocationRunner,
} from "../../src/providers/structured-invocation";

const jsonSchema = {
  type: "object",
  properties: { value: { type: "string" } },
  required: ["value"],
  additionalProperties: false,
};

const successfulResult = (stdout = ""): ProviderProcessResult => ({
  exitCode: 0,
  stdout,
  stderr: "",
});

const resultPathFrom = (input: ProviderProcessInput): string => {
  const flagIndex = input.args.indexOf("--output-last-message");
  const path = input.args.at(flagIndex + 1);
  if (flagIndex < 0 || path === undefined) {
    throw new RangeError("CODEX_RESULT_PATH_MISSING");
  }
  return path;
};

describe("shared structured provider invocation", () => {
  test("parses Codex output and removes its temporary workspace", async () => {
    // Given
    let workspace = "";
    const runner: StructuredInvocationRunner = async (input) => {
      workspace = input.cwd ?? "";
      await writeFile(resultPathFrom(input), JSON.stringify({ value: "codex" }), "utf8");
      return successfulResult();
    };

    // When
    const output = await invokeStructuredProvider({
      provider: "codex",
      prompt: "Produce a value",
      jsonSchema,
      parse: (value) => value,
      runner,
    });

    // Then
    expect(output).toEqual({ value: "codex" });
    expect(workspace).not.toBe("");
    expect(await exists(workspace)).toBe(false);
  });

  test("rejects an oversized Codex result file before parsing it", async () => {
    // Given
    let parsed = false;
    let workspace = "";
    const runner: StructuredInvocationRunner = async (input) => {
      workspace = input.cwd ?? "";
      const resultPath = resultPathFrom(input);
      await writeFile(resultPath, "", "utf8");
      await truncate(resultPath, MAX_PROVIDER_OUTPUT_BYTES + 1);
      return successfulResult();
    };

    // When
    const invocation = invokeStructuredProvider({
      provider: "codex",
      prompt: "Produce a value",
      jsonSchema,
      parse: (value) => {
        parsed = true;
        return value;
      },
      runner,
    });

    // Then
    await expect(invocation).rejects.toEqual(
      expect.objectContaining({ code: "PROVIDER_OUTPUT_TOO_LARGE" }),
    );
    expect(parsed).toBe(false);
    expect(await exists(workspace)).toBe(false);
  });

  test("parses Claude structured output and removes its temporary workspace", async () => {
    // Given
    let workspace = "";
    const runner: StructuredInvocationRunner = async (input) => {
      workspace = input.cwd ?? "";
      return successfulResult(
        JSON.stringify({
          type: "result",
          subtype: "success",
          structured_output: { value: "claude" },
        }),
      );
    };

    // When
    const output = await invokeStructuredProvider({
      provider: "claude",
      prompt: "Produce a value",
      jsonSchema,
      parse: (value) => value,
      runner,
    });

    // Then
    expect(output).toEqual({ value: "claude" });
    expect(await exists(workspace)).toBe(false);
  });

  test("maps timeout and process failures and cleans failed workspaces", async () => {
    // Given
    const workspaces: string[] = [];
    const timeoutRunner: StructuredInvocationRunner = async (input) => {
      workspaces.push(input.cwd ?? "");
      throw new Error("PROVIDER_TIMEOUT");
    };
    const processRunner: StructuredInvocationRunner = async (input) => {
      workspaces.push(input.cwd ?? "");
      throw new Error("spawn codex ENOENT");
    };

    // When
    const timeoutAssertion = expect(
      invokeStructuredProvider({
        provider: "codex",
        prompt: "value",
        jsonSchema,
        parse: (value) => value,
        runner: timeoutRunner,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "PROVIDER_TIMEOUT" }));
    const unavailableAssertion = expect(
      invokeStructuredProvider({
        provider: "claude",
        prompt: "value",
        jsonSchema,
        parse: (value) => value,
        runner: processRunner,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "PROVIDER_UNAVAILABLE" }));

    // Then
    await Promise.all([timeoutAssertion, unavailableAssertion]);
    for (const workspace of workspaces) {
      expect(await exists(workspace)).toBe(false);
    }
  });

  test("maps a nonzero provider exit without exposing the home directory", async () => {
    // Given
    const { USERPROFILE: userProfile } = process.env;
    const runner: StructuredInvocationRunner = async () => ({
      exitCode: 1,
      stdout: "",
      stderr: `${userProfile ?? "C:\\Users\\tester"}\\secret token rejected`,
    });

    // When
    const invocation = invokeStructuredProvider({
      provider: "claude",
      prompt: "value",
      jsonSchema,
      parse: (value) => value,
      runner,
    });

    // Then
    await Promise.all([
      expect(invocation).rejects.toEqual(expect.objectContaining({ code: "PROVIDER_FAILED" })),
      expect(invocation).rejects.not.toThrow(userProfile ?? "C:\\Users\\tester"),
    ]);
  });
});
