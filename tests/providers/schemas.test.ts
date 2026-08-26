import { describe, expect, test } from "bun:test";

import type { StrategicPlan } from "../../src/providers/schemas";
import { parseStrategicPlan, strategicPlanJsonSchema } from "../../src/providers/schemas";

describe("strategic provider schema", () => {
  test("parses a bounded structured plan", () => {
    // Given
    const plan: StrategicPlan = {
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

    // When
    const parsed = parseStrategicPlan(plan);

    // Then
    expect(parsed).toEqual(plan);
  });

  test("rejects empty NPC actions, extra fields, and invalid world references", () => {
    // Given
    const invalidPlans = [
      {
        schemaVersion: 1,
        requestId: "req_0000000000000001",
        playerIntents: [],
        npcIntents: [],
        narrative: { ko: "빈 계획" },
        warnings: [],
      },
      {
        schemaVersion: 1,
        requestId: "req_0000000000000001",
        playerIntents: [],
        npcIntents: [{ type: "unknown" }],
        narrative: { ko: "잘못된 계획" },
        warnings: [],
        authoritativeTreasuryDelta: 999_999,
      },
    ];

    // When
    const parseInvalid = () => invalidPlans.map(parseStrategicPlan);

    // Then
    expect(parseInvalid).toThrow();
  });

  test("emits draft-07 JSON Schema accepted by subscription CLIs", () => {
    // Given
    const unsupportedDraft = "https://json-schema.org/draft/2020-12/schema";

    // When
    const schemaJson = JSON.stringify(strategicPlanJsonSchema());

    // Then
    expect(schemaJson).toContain("http://json-schema.org/draft-07/schema#");
    expect(schemaJson).not.toContain(unsupportedDraft);
    expect(schemaJson).not.toContain('"items":[');
    expect(schemaJson).not.toContain('"oneOf"');
  });
});
