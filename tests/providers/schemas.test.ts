import { describe, expect, expectTypeOf, test } from "bun:test";
import Ajv from "ajv";
import { z } from "zod";

import type { StrategicPlan, StrategicPlanInput } from "../../src/providers/schemas";
import {
  parseProviderStrategicPlan,
  parseStrategicPlan,
  strategicPlanCore,
  strategicPlanJsonSchema,
} from "../../src/providers/schemas";
import {
  MAX_PEACE_TERMS,
  MAX_STRATEGIC_IDENTIFIER_LENGTH,
} from "../../src/providers/strategic-intent-schema";

describe("strategic provider schema", () => {
  test("parses a bounded structured plan", () => {
    // Given
    const plan: StrategicPlanInput = {
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
    const versionTwoInput: StrategicPlanInput = { ...plan, schemaVersion: 2 };

    // When
    const parsed = parseStrategicPlan(plan);
    const parsedVersionTwo = parseStrategicPlan(versionTwoInput);

    // Then
    expect([parsed.schemaVersion, parsedVersionTwo.schemaVersion]).toEqual([2, 2]);
    expect(parsed).toEqual({ ...plan, schemaVersion: 2 });
    expect(parsedVersionTwo).toEqual({ ...plan, schemaVersion: 2 });
    expectTypeOf(parsed.schemaVersion).toEqualTypeOf<2>();
    const normalized: StrategicPlan = parsed;
    const acceptNormalizedPlan = (_normalized: { readonly schemaVersion: 2 }): void => undefined;
    acceptNormalizedPlan(normalized);
  });

  test("normalizes the core plan and strips presentation", () => {
    // Given
    const plan: StrategicPlan = {
      schemaVersion: 2,
      requestId: "req_core_characterization",
      playerIntents: [],
      npcIntents: [
        {
          type: "military.recruit",
          actorNationId: "nat_jpn",
          provinceId: "prv_jpn_kanto",
          manpower: 2_000,
        },
      ],
      narrative: { ko: "각국이 행동했다." },
      presentation: {
        article: {
          headlineKo: "새 계획 발표",
          ledeKo: "정부가 새 계획을 발표했다.",
          paragraphsKo: ["정부는 시행을 밝혔다.", "주변국은 영향을 주시했다."],
        },
        reactions: [
          {
            nationId: "nat_kor",
            stance: "supportive",
            sentimentBps: 100,
            statementKo: "계획을 지지한다.",
          },
        ],
      },
      warnings: [],
    };

    // When
    const core = strategicPlanCore(plan);

    // Then
    expect(core).toEqual({
      schemaVersion: 2,
      requestId: plan.requestId,
      playerIntents: plan.playerIntents,
      npcIntents: plan.npcIntents,
      narrative: plan.narrative,
      warnings: plan.warnings,
    });
    expect("presentation" in core).toBe(false);
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
    expect(schemaJson).toContain('"oneOf"');
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

  test("rejects unit and peace intents without an explicit actor", () => {
    // Given
    const unboundIntents = [
      { type: "unit.move", unitId: "unt_1_0", toProvinceId: "prv_kor_hanseong" },
      { type: "unit.attack", unitId: "unt_1_0", targetProvinceId: "prv_jpn_kanto" },
      { type: "unit.disband", unitId: "unt_1_0" },
      { type: "war.peace", warId: "war_1_0", terms: [] },
    ];

    // When / Then
    for (const intent of unboundIntents) {
      expect(() =>
        parseStrategicPlan({
          schemaVersion: 2,
          requestId: "req_actor_required",
          playerIntents: [intent],
          npcIntents: [
            {
              type: "military.recruit",
              actorNationId: "nat_jpn",
              provinceId: "prv_jpn_kanto",
              manpower: 2_000,
            },
          ],
          narrative: { ko: "행위자 검증" },
          warnings: [],
        }),
      ).toThrow();
    }
  });

  test("parses every v2 intent from wire JSON and advertises each discriminator", () => {
    // Given
    const intents = [
      {
        type: "nation.adjust",
        nationId: "nat_kor",
        treasuryDelta: 20,
        stabilityDelta: -100,
        gdpDelta: 50,
        taxRateBps: 1_600,
        reasonKo: "재정 개혁",
        sourceQuoteKo: "재정 개혁을 단행하라",
      },
      {
        type: "relation.adjust",
        fromNationId: "nat_kor",
        toNationId: "nat_jpn",
        delta: -500,
        reasonKo: "외교 마찰",
        sourceQuoteKo: "대일 관계를 재검토하라",
      },
      {
        type: "treaty.respond",
        treatyId: "try_1_0",
        decision: "accept",
        actorNationId: "nat_kor",
        sourceQuoteKo: "조약을 수락하라",
      },
      {
        type: "treaty.terminate",
        treatyId: "try_1_0",
        actorNationId: "nat_kor",
        reasonKo: "상대국의 의무 불이행",
        sourceQuoteKo: "조약을 파기하라",
      },
      {
        type: "war.declare",
        actorNationId: "nat_kor",
        targetNationId: "nat_jpn",
        casusBelliKo: "국경 침범",
        sourceQuoteKo: "일본에 선전포고하라",
      },
      {
        type: "war.peace",
        actorNationId: "nat_kor",
        warId: "war_1_0",
        terms: [
          {
            type: "territory.transfer",
            actorNationId: "nat_kor",
            provinceId: "prv_jpn_kanto",
            fromNationId: "nat_jpn",
            toNationId: "nat_kor",
            reasonKo: "강화 조약",
            sourceQuoteKo: "관동을 양도하라",
          },
        ],
        reparationsCredits: 100,
        sourceQuoteKo: "배상 조건으로 강화하라",
      },
      {
        type: "unit.move",
        actorNationId: "nat_kor",
        unitId: "unt_1_0",
        toProvinceId: "prv_kor_jeolla",
        sourceQuoteKo: "부대를 전라로 이동하라",
      },
      {
        type: "unit.attack",
        actorNationId: "nat_kor",
        unitId: "unt_1_0",
        targetProvinceId: "prv_jpn_kanto",
        sourceQuoteKo: "관동을 공격하라",
      },
      {
        type: "unit.disband",
        actorNationId: "nat_kor",
        unitId: "unt_1_0",
        sourceQuoteKo: "부대를 해산하라",
      },
      {
        type: "polity.change",
        nationId: "nat_kor",
        nameKo: "대한제국",
        governmentKo: "입헌군주제",
        capitalProvinceId: "prv_kor_hanseong",
        sourceQuoteKo: "입헌 체제로 전환하라",
      },
      {
        type: "action.fail",
        actorNationId: "nat_kor",
        attemptKo: "해군 증강",
        stabilityDelta: -200,
        sourceQuoteKo: "해군 증강을 시도하라",
      },
    ] as const;

    const planFor = (intent: (typeof intents)[number], index: number) => ({
      schemaVersion: index % 2 === 0 ? 1 : 2,
      requestId: `req_v2_intent_${index}`,
      playerIntents: [intent],
      npcIntents: [
        {
          type: "military.recruit",
          actorNationId: "nat_jpn",
          provinceId: "prv_jpn_kanto",
          manpower: 2_000,
          sourceQuoteKo: null,
        },
      ],
      narrative: { ko: "계획이 수립됐다." },
      presentation: {
        article: {
          headlineKo: "새 계획 발표",
          ledeKo: "정부가 새 계획을 발표했다.",
          paragraphsKo: [
            "정부는 계획을 즉시 시행한다고 밝혔다.",
            "주변국은 향후 영향을 주시하고 있다.",
          ],
          quote: null,
        },
        reactions: [
          {
            nationId: "nat_kor",
            stance: "supportive",
            sentimentBps: 100,
            statementKo: "계획을 지지한다.",
          },
        ],
      },
      warnings: [],
    });
    const plans = intents.map(planFor);
    const jsonSchema = z.record(z.string(), z.unknown()).parse(strategicPlanJsonSchema());
    const validate = new Ajv({ strict: false }).compile(jsonSchema);

    // When
    const parsedPlans = plans.map(parseProviderStrategicPlan);
    const discriminatorSchema = z.object({
      properties: z.object({
        playerIntents: z.object({
          items: z.object({
            oneOf: z.array(
              z.object({ properties: z.object({ type: z.object({ enum: z.array(z.string()) }) }) }),
            ),
          }),
        }),
      }),
    });
    const schema = discriminatorSchema.parse(jsonSchema);
    const advertisedTypes = schema.properties.playerIntents.items.oneOf.flatMap(
      (variant) => variant.properties.type.enum,
    );
    const supportedTypes = [
      "economy.invest",
      "diplomacy.propose_treaty",
      "military.recruit",
      "territory.transfer",
      "nation.adjust",
      "relation.adjust",
      "treaty.respond",
      "treaty.terminate",
      "war.declare",
      "war.peace",
      "unit.move",
      "unit.attack",
      "unit.disband",
      "polity.change",
      "action.fail",
    ];
    const nullNationId = { ...plans[0], playerIntents: [{ ...intents[0], nationId: null }] };
    const outOfBounds = {
      ...plans[0],
      playerIntents: [{ ...intents[0], stabilityDelta: 10_001 }],
    };
    const extraProperty = {
      ...plans[0],
      playerIntents: [{ ...intents[0], unadvertised: true }],
    };
    const unknownType = { ...plans[0], playerIntents: [{ type: "unknown" }] };

    // Then
    expect(parsedPlans.map((plan) => plan.playerIntents[0])).toEqual([...intents]);
    expect(parsedPlans.map((plan) => plan.schemaVersion)).toEqual(intents.map(() => 2));
    expect(plans.map((plan) => validate(plan))).toEqual(intents.map(() => true));
    expect(advertisedTypes).toEqual(supportedTypes);
    expect(validate(nullNationId)).toBe(true);
    expect(() => parseProviderStrategicPlan(nullNationId)).toThrow();
    expect(validate(outOfBounds)).toBe(false);
    expect(validate(extraProperty)).toBe(false);
    expect(validate(unknownType)).toBe(false);
    expect(() => parseProviderStrategicPlan(unknownType)).toThrow();
  });

  test("accepts 32 NPC intents but rejects 33 and unknown intent types", () => {
    // Given
    const npcIntent = {
      type: "military.recruit",
      actorNationId: "nat_jpn",
      provinceId: "prv_jpn_kanto",
      manpower: 2_000,
    } as const;
    const planWith = (npcIntents: readonly unknown[]) => ({
      schemaVersion: 2,
      requestId: "req_npc_limit",
      playerIntents: [],
      npcIntents,
      narrative: { ko: "각국이 행동했다." },
      warnings: [],
    });

    // When
    const accepted = parseStrategicPlan(planWith(Array.from({ length: 32 }, () => npcIntent)));
    const parseTooMany = () =>
      parseStrategicPlan(planWith(Array.from({ length: 33 }, () => npcIntent)));
    const parseUnknown = () => parseStrategicPlan(planWith([{ type: "unknown" }]));

    // Then
    expect(accepted.npcIntents).toHaveLength(32);
    expect(parseTooMany).toThrow();
    expect(parseUnknown).toThrow();
  });

  test("bounds nested peace terms and strategic identifiers in runtime and JSON schemas", () => {
    // Given
    const term = {
      type: "territory.transfer",
      actorNationId: "nat_kor",
      provinceId: "prv_jpn_kanto",
      fromNationId: "nat_jpn",
      toNationId: "nat_kor",
      reasonKo: "강화 조약",
      sourceQuoteKo: null,
    } as const;
    const planWith = (terms: readonly (typeof term)[], actorNationId = "nat_kor") => ({
      schemaVersion: 2,
      requestId: "req_peace_term_limit",
      playerIntents: [],
      npcIntents: [
        {
          type: "war.peace",
          actorNationId,
          warId: "war_1_0",
          terms,
          reparationsCredits: null,
          sourceQuoteKo: null,
        },
      ],
      narrative: { ko: "강화 조건을 검토했다." },
      presentation: {
        article: {
          headlineKo: "강화 협상",
          ledeKo: "교전국이 강화 조건을 검토했다.",
          paragraphsKo: ["대표단이 협상을 시작했다.", "주변국은 결과를 주시했다."],
          quote: null,
        },
        reactions: [
          {
            nationId: "nat_kor",
            stance: "cautious",
            sentimentBps: 0,
            statementKo: "협상 결과를 기다리겠다.",
          },
        ],
      },
      warnings: [],
    });
    const accepted = planWith(Array.from({ length: MAX_PEACE_TERMS }, () => term));
    const tooMany = planWith(Array.from({ length: MAX_PEACE_TERMS + 1 }, () => term));
    const longId = planWith([], `nat_${"x".repeat(MAX_STRATEGIC_IDENTIFIER_LENGTH)}`);
    const validate = new Ajv({ strict: false }).compile(strategicPlanJsonSchema());

    // When / Then
    expect(parseProviderStrategicPlan(accepted).npcIntents[0]).toMatchObject({
      terms: expect.any(Array),
    });
    expect(() => parseProviderStrategicPlan(tooMany)).toThrow();
    expect(() => parseProviderStrategicPlan(longId)).toThrow();
    expect(validate(accepted)).toBe(true);
    expect(validate(tooMany)).toBe(false);
    expect(validate(longId)).toBe(false);
  });
});
