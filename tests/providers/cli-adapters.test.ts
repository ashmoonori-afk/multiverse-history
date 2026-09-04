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
  presentation: {
    article: {
      headlineKo: "일본제국, 병력 증강 착수",
      ledeKo: "일본 정부가 역내 군사 태세 강화에 나섰다.",
      paragraphsKo: [
        "관계 당국은 규슈 지역의 병력 충원을 우선 시행한다고 밝혔다.",
        "주변국들은 이번 조치가 동아시아 정세에 미칠 영향을 주시하고 있다.",
      ],
      quote: null,
    },
    reactions: [
      {
        nationId: "nat_jpn",
        stance: "supportive",
        sentimentBps: 500,
        statementKo: "국방 태세를 강화하겠다.",
      },
    ],
  },
  warnings: [],
};

describe("Codex CLI adapter", () => {
  test("builds a read-only structured invocation without a shell", () => {
    // Given
    const input = {
      schemaPath: "C:\\tmp\\strategic-plan.schema.json",
      resultPath: "C:\\tmp\\result.json",
    } as const;

    // When
    const args = buildCodexArguments(input);

    // Then
    expect(args).toEqual([
      "exec",
      "--ephemeral",
      "--ignore-rules",
      "--model",
      "gpt-5.4-mini",
      "-c",
      'model_reasoning_effort="low"',
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
    expect(parsed.presentation?.article.headlineKo).toBe(validPlan.presentation.article.headlineKo);
    expect(parsed.presentation?.reactions).toHaveLength(1);
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
