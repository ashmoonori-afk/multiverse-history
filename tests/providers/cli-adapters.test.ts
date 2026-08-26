import { describe, expect, test } from "bun:test";

import { buildClaudeArguments, parseClaudeEnvelope } from "../../src/providers/claude-provider";
import { buildCodexArguments, parseCodexLastMessage } from "../../src/providers/codex-provider";

const validPlan = {
  schemaVersion: 1,
  requestId: "req_0000000000000001",
  playerIntents: [],
  npcIntents: [
    {
      type: "military.recruit",
      actorNationId: "nat_jpn",
      provinceId: "prv_jpn_kanto",
      manpower: 2_000,
    },
  ],
  narrative: { ko: "일본제국은 병력을 증강했다." },
  warnings: [],
};

describe("Codex CLI adapter", () => {
  test("builds a read-only structured invocation without a shell", () => {
    // Given
    const input = {
      schemaPath: "C:\\tmp\\strategic-plan.schema.json",
      resultPath: "C:\\tmp\\result.json",
    };

    // When
    const args = buildCodexArguments(input);

    // Then
    expect(args).toEqual([
      "exec",
      "--json",
      "--output-schema",
      input.schemaPath,
      "--output-last-message",
      input.resultPath,
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "-",
    ]);
  });

  test("parses the last-message file and rejects malformed output", () => {
    // Given
    const valid = JSON.stringify(validPlan);
    const malformed = "{";

    // When
    const parsed = parseCodexLastMessage(valid);
    const parseMalformed = () => parseCodexLastMessage(malformed);

    // Then
    expect(parsed.requestId).toBe(validPlan.requestId);
    expect(parseMalformed).toThrow("PROVIDER_MALFORMED_OUTPUT");
  });
});

describe("Claude CLI adapter", () => {
  test("builds a plan-only subscription invocation", () => {
    // Given
    const schemaJson = '{"type":"object"}';

    // When
    const args = buildClaudeArguments(schemaJson);

    // Then
    expect(args).toEqual([
      "-p",
      "--output-format",
      "json",
      "--json-schema",
      schemaJson,
      "--permission-mode",
      "plan",
      "--tools",
      "",
      "--no-session-persistence",
    ]);
  });

  test("parses the provider envelope and rejects an empty result", () => {
    // Given
    const valid = JSON.stringify({ type: "result", subtype: "success", result: validPlan });
    const empty = JSON.stringify({ type: "result", subtype: "success", result: "" });

    // When
    const parsed = parseClaudeEnvelope(valid);
    const parseEmpty = () => parseClaudeEnvelope(empty);

    // Then
    expect(parsed.requestId).toBe(validPlan.requestId);
    expect(parseEmpty).toThrow("PROVIDER_EMPTY_OUTPUT");
  });
});
