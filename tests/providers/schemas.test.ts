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

  test("preserves special-zone treaty conditions in strategic intents", () => {
    // Given
    const treatyIntent = {
      type: "diplomacy.propose_treaty",
      actorNationId: "nat_kor",
      recipientNationId: "nat_gbr",
      provinceId: "prv_kor_jeolla",
      clauses: ["trade", "port_access", "weapons_support", "officer_training"],
      termsKo: "제주부 무역특구 입항 조건",
    } as const;
    const plan: unknown = {
      schemaVersion: 1,
      requestId: "req_trade_zone_schema",
      playerIntents: [treatyIntent],
      npcIntents: [
        {
          type: "military.recruit",
          actorNationId: "nat_jpn",
          provinceId: "prv_jpn_kanto",
          manpower: 2_000,
        },
      ],
      narrative: { ko: "대한제국은 조건부 입항 제안을 발표했다." },
      warnings: [],
    };

    // When
    const parsed = parseStrategicPlan(plan);
    const treaty = parsed.playerIntents[0];

    // Then
    expect(treaty).toEqual(treatyIntent);
  });

  test("carries an explicit territory transfer with its stated reason", () => {
    // Given
    const transferIntent = {
      type: "territory.transfer",
      actorNationId: "nat_kor",
      provinceId: "prv_qing_zhili",
      fromNationId: "nat_qing",
      toNationId: "nat_kor",
      reasonKo: "강화 조약에 따른 할양",
    } as const;
    const plan: unknown = {
      schemaVersion: 1,
      requestId: "req_territory_transfer",
      playerIntents: [transferIntent],
      npcIntents: [
        {
          type: "military.recruit",
          actorNationId: "nat_jpn",
          provinceId: "prv_jpn_kanto",
          manpower: 2_000,
        },
      ],
      narrative: { ko: "대한제국은 조약을 통해 즈리를 넘겨받았다." },
      warnings: [],
    };

    // When
    const parsed = parseStrategicPlan(plan);

    // Then
    expect(parsed.playerIntents[0]).toEqual(transferIntent);
  });

  test("advertises the territory transfer contract in the emitted JSON Schema", () => {
    // Given
    const schemaJson = JSON.stringify(strategicPlanJsonSchema());

    // When
    const declaresTransfer = schemaJson.includes("territory.transfer");

    // Then
    expect(declaresTransfer).toBe(true);
    expect(schemaJson).toContain("fromNationId");
    expect(schemaJson).toContain("reasonKo");
  });

  test("accepts any buildable sector the model names, not only rail", () => {
    // Given the player asked for a harbour and an airfield, which no enum anticipated
    const sectors = ["rail", "port", "airfield", "shipyard", "telegraph"] as const;

    // When
    const parsed = sectors.map((sector) =>
      parseStrategicPlan({
        schemaVersion: 1,
        requestId: "req_open_sector",
        playerIntents: [
          {
            type: "economy.invest",
            actorNationId: "nat_kor",
            provinceId: "prv_kor_hanseong",
            sector,
            budgetCredits: 60,
            sourceQuoteKo: "항구를 건설하라",
          },
        ],
        npcIntents: [
          {
            type: "military.recruit",
            actorNationId: "nat_jpn",
            provinceId: "prv_jpn_kanto",
            manpower: 2_000,
          },
        ],
        narrative: { ko: "건설이 시작됐다." },
        warnings: [],
      }),
    );

    // Then
    expect(
      parsed.map((plan) =>
        plan.playerIntents[0]?.type === "economy.invest" ? plan.playerIntents[0].sector : null,
      ),
    ).toEqual([...sectors]);
  });

  test("rejects a sector that is not a short lowercase noun", () => {
    // Given
    const parseShouty = () =>
      parseStrategicPlan({
        schemaVersion: 1,
        requestId: "req_bad_sector",
        playerIntents: [
          {
            type: "economy.invest",
            actorNationId: "nat_kor",
            provinceId: "prv_kor_hanseong",
            sector: "Build A Giant PORT!!",
            budgetCredits: 60,
            sourceQuoteKo: "항구를 건설하라",
          },
        ],
        npcIntents: [
          {
            type: "military.recruit",
            actorNationId: "nat_jpn",
            provinceId: "prv_jpn_kanto",
            manpower: 2_000,
          },
        ],
        narrative: { ko: "건설이 시작됐다." },
        warnings: [],
      });

    // Then
    expect(parseShouty).toThrow();
  });

  test("advertises the source-quote contract in the emitted JSON Schema", () => {
    // Given
    const schemaJson = JSON.stringify(strategicPlanJsonSchema());

    // Then
    expect(schemaJson).toContain("sourceQuoteKo");
    expect(schemaJson).not.toContain('"enum":["rail",null]');
  });
});
