import { describe, expect, test } from "bun:test";

import {
  type CampaignResolution,
  CampaignResolutionSchema,
  createCampaignResolution,
} from "../../src/application/campaign-resolution";
import { createCampaignState, parseCampaignState } from "../../src/application/campaign-state";
import { importCampaignExport, serializeCampaignExport } from "../../src/persistence/export-import";
import { hashCanonical } from "../../src/shared/canonical-json";

const scenario = {
  id: "scn_ea1900",
  revision: 1,
  canonicalHash: "a".repeat(64),
};

const legacyMessage = {
  id: "chat_0_1",
  role: "player" as const,
  speakerNationId: "nat_kor",
  targetNationId: "nat_jpn",
  topic: "general" as const,
  intent: "statement" as const,
  turn: 0,
  date: { year: 1900, quarter: 1 },
  text: "철도 협력을 논의합시다.",
};

const legacyCampaign = () => {
  const base = createCampaignState("scn_ea1900", "nat_kor");
  const resolution = createCampaignResolution({
    before: base,
    after: base,
    turn: 1,
    cadence: "month",
    advanceDays: 30,
    orderText: "내정을 정비한다.",
    narrativeKo: "조선 정부는 내정 정비를 시작했다.",
    changedProvinceIds: [],
  });
  return {
    ...base,
    resolutions: [resolution],
    chatMessages: [legacyMessage],
  };
};

const fallbackNpcIntent = {
  type: "action.fail" as const,
  actorNationId: "nat_jpn",
  attemptKo: "참조 무결성 테스트",
  stabilityDelta: -1,
};

const planWithIntent = (
  lane: "playerIntents" | "npcIntents",
  intent: Readonly<Record<string, unknown>>,
  schemaVersion: 1 | 2 = 2,
) => ({
  schemaVersion,
  requestId: "req_province_reference",
  playerIntents: lane === "playerIntents" ? [intent] : [],
  npcIntents: lane === "npcIntents" ? [intent] : [fallbackNpcIntent],
  narrative: { ko: "참조 무결성 테스트 계획" },
  warnings: [],
});

const lastPlanReferenceCases = [
  {
    name: "player economy provinceId",
    lane: "playerIntents" as const,
    intent: {
      type: "economy.invest",
      actorNationId: "nat_kor",
      provinceId: "prv_missing",
      sector: "rail",
      budgetCredits: 20,
    },
  },
  {
    name: "npc treaty provinceId",
    lane: "npcIntents" as const,
    intent: {
      type: "diplomacy.propose_treaty",
      actorNationId: "nat_jpn",
      recipientNationId: "nat_kor",
      provinceId: "prv_missing",
      clauses: ["trade"],
    },
  },
  {
    name: "player recruitment provinceId",
    lane: "playerIntents" as const,
    intent: {
      type: "military.recruit",
      actorNationId: "nat_kor",
      provinceId: "prv_missing",
      manpower: 500,
    },
  },
  {
    name: "npc direct-transfer provinceId",
    lane: "npcIntents" as const,
    intent: {
      type: "territory.transfer",
      actorNationId: "nat_jpn",
      provinceId: "prv_missing",
      fromNationId: "nat_jpn",
      toNationId: "nat_kor",
      reasonKo: "직접 할양",
    },
  },
  {
    name: "player peace-term provinceId",
    lane: "playerIntents" as const,
    intent: {
      type: "war.peace",
      actorNationId: "nat_kor",
      warId: "war_1_0",
      terms: [
        {
          type: "territory.transfer",
          actorNationId: "nat_kor",
          provinceId: "prv_missing",
          fromNationId: "nat_jpn",
          toNationId: "nat_kor",
          reasonKo: "강화 조약",
        },
      ],
    },
  },
  {
    name: "npc unit toProvinceId",
    lane: "npcIntents" as const,
    intent: {
      type: "unit.move",
      actorNationId: "nat_jpn",
      unitId: "unt_jpn_1",
      toProvinceId: "prv_missing",
    },
  },
  {
    name: "player attack targetProvinceId",
    lane: "playerIntents" as const,
    intent: {
      type: "unit.attack",
      actorNationId: "nat_kor",
      unitId: "unt_kor_1",
      targetProvinceId: "prv_missing",
    },
  },
  {
    name: "npc polity capitalProvinceId",
    lane: "npcIntents" as const,
    intent: {
      type: "polity.change",
      nationId: "nat_jpn",
      capitalProvinceId: "prv_missing",
    },
  },
] as const;

const resolutionReferenceCases: readonly {
  readonly name: string;
  readonly mutate: (resolution: CampaignResolution, validProvinceId: string) => CampaignResolution;
}[] = [
  {
    name: "changed province",
    mutate: (resolution) => ({
      ...resolution,
      worldImpact: { ...resolution.worldImpact, changedProvinceIds: ["prv_missing"] },
    }),
  },
  {
    name: "ownership override",
    mutate: (resolution) => ({
      ...resolution,
      worldImpact: {
        ...resolution.worldImpact,
        regionOwnershipOverrides: [
          {
            regionId: "prv_missing",
            fromNationId: "nat_jpn",
            toNationId: "nat_kor",
            reasonKo: "직접 할양",
            cause: "player",
            source: "policy",
          },
        ],
      },
    }),
  },
  {
    name: "unit delta before province",
    mutate: (resolution, validProvinceId) => ({
      ...resolution,
      unitDeltas: [
        {
          unitId: "unt_reference_1",
          ownerNationId: "nat_kor",
          before: {
            ownerNationId: "nat_kor",
            provinceId: "prv_missing",
            manpower: 500,
          },
          after: { ownerNationId: "nat_kor", provinceId: validProvinceId, manpower: 500 },
          source: "policy",
        },
      ],
    }),
  },
  {
    name: "unit delta after province",
    mutate: (resolution, validProvinceId) => ({
      ...resolution,
      unitDeltas: [
        {
          unitId: "unt_reference_1",
          ownerNationId: "nat_kor",
          before: { ownerNationId: "nat_kor", provinceId: validProvinceId, manpower: 500 },
          after: {
            ownerNationId: "nat_kor",
            provinceId: "prv_missing",
            manpower: 500,
          },
          source: "policy",
        },
      ],
    }),
  },
];

describe("campaign state compatibility", () => {
  test("rejects malformed province identifiers at the parser boundary", () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const firstNation = base.nations[0];
    const firstProvince = base.provinces[0];
    const firstUnit = base.units[0];
    if (firstNation === undefined || firstProvince === undefined || firstUnit === undefined) {
      throw new RangeError("TEST_SCENARIO_INCOMPLETE");
    }
    const malformedStates = [
      {
        ...base,
        nations: [{ ...firstNation, capitalProvinceId: "prv_KOR" }, ...base.nations.slice(1)],
      },
      {
        ...base,
        provinces: [{ ...firstProvince, id: "prv_KOR" }, ...base.provinces.slice(1)],
      },
      {
        ...base,
        provinces: [
          { ...firstProvince, adjacentProvinceIds: ["prv_KOR"] },
          ...base.provinces.slice(1),
        ],
      },
      {
        ...base,
        units: [{ ...firstUnit, provinceId: "prv_KOR" }, ...base.units.slice(1)],
      },
      {
        ...base,
        constructionProjects: [
          {
            id: "cst_1_1",
            ownerNationId: "nat_kor",
            provinceId: "prv_KOR",
            kind: "rail",
            investedCredits: 50,
            startedTurn: 1,
            status: "active",
          },
        ],
      },
    ];

    // When / Then
    for (const state of malformedStates) {
      expect(() => parseCampaignState(state)).toThrow();
    }
  });

  test("rejects dangling province references after a valid import", () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const firstProvince = base.provinces[0];
    const firstUnit = base.units[0];
    if (firstProvince === undefined || firstUnit === undefined) {
      throw new RangeError("TEST_SCENARIO_INCOMPLETE");
    }
    const danglingProvinceId = "prv_missing";
    const danglingStates = [
      {
        ...base,
        provinces: [
          { ...firstProvince, adjacentProvinceIds: [danglingProvinceId] },
          ...base.provinces.slice(1),
        ],
      },
      {
        ...base,
        units: [{ ...firstUnit, provinceId: danglingProvinceId }, ...base.units.slice(1)],
      },
      {
        ...base,
        constructionProjects: [
          {
            id: "cst_1_1",
            ownerNationId: "nat_kor",
            provinceId: danglingProvinceId,
            kind: "rail",
            investedCredits: 50,
            startedTurn: 1,
            status: "active",
          },
        ],
      },
    ];

    // When / Then
    for (const state of danglingStates) {
      const imported = importCampaignExport({
        json: serializeCampaignExport({ scenario, state }),
        expectedScenario: scenario,
      });
      expect(() => parseCampaignState(imported.state)).toThrow(
        "CAMPAIGN_PROVINCE_REFERENCE_NOT_FOUND",
      );
    }
  });

  test("rejects a dangling nation capital province reference", () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const firstNation = base.nations[0];
    if (firstNation === undefined) throw new RangeError("TEST_SCENARIO_INCOMPLETE");

    // When
    const parse = () =>
      parseCampaignState({
        ...base,
        nations: [{ ...firstNation, capitalProvinceId: "prv_missing" }, ...base.nations.slice(1)],
      });

    // Then
    expect(parse).toThrow("CAMPAIGN_PROVINCE_REFERENCE_NOT_FOUND");
  });

  test("rejects every dangling world-event province reference", () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const unit = base.units[0];
    if (unit === undefined) throw new RangeError("TEST_SCENARIO_INCOMPLETE");
    const event = {
      id: "evt_1_1",
      kind: "military" as const,
      importance: "major" as const,
      occurredAtElapsedDays: 30,
      turn: 1,
      date: { year: 1900, quarter: 1 },
      actorNationIds: ["nat_kor"],
      affectedNationIds: ["nat_kor"],
      headlineKo: "테스트 사건",
      summaryKo: "참조 무결성 테스트 사건이다.",
      impacts: {
        regionTransfers: [],
        nationChanges: [],
        relationChanges: [],
        unitOps: [],
      },
      provenance: "simulated_consequence" as const,
      regionIds: [],
      sourceInputIds: ["req_1"],
    };
    const danglingEvents = [
      { ...event, regionIds: ["prv_missing"] },
      {
        ...event,
        impacts: {
          ...event.impacts,
          regionTransfers: [{ regionId: "prv_missing", toNationId: "nat_kor" }],
        },
      },
      {
        ...event,
        impacts: {
          ...event.impacts,
          unitOps: [
            {
              op: "spawn" as const,
              ownerNationId: "nat_kor",
              provinceId: "prv_missing",
              manpower: 500,
            },
          ],
        },
      },
      {
        ...event,
        impacts: {
          ...event.impacts,
          unitOps: [{ op: "move" as const, unitId: unit.id, provinceId: "prv_missing" }],
        },
      },
    ];

    // When / Then
    for (const worldEvent of danglingEvents) {
      expect(() => parseCampaignState({ ...base, worldEvents: [worldEvent] })).toThrow(
        "CAMPAIGN_PROVINCE_REFERENCE_NOT_FOUND",
      );
    }
  });

  for (const referenceCase of lastPlanReferenceCases) {
    test(`rejects dangling lastPlan ${referenceCase.name} after import`, () => {
      // Given
      const base = createCampaignState("scn_ea1900", "nat_kor");
      const state = {
        ...base,
        lastPlan: planWithIntent(referenceCase.lane, referenceCase.intent),
      };
      const imported = importCampaignExport({
        json: serializeCampaignExport({ scenario, state }),
        expectedScenario: scenario,
      });

      // When
      const parse = () => parseCampaignState(imported.state);

      // Then
      expect(parse).toThrow("CAMPAIGN_PROVINCE_REFERENCE_NOT_FOUND");
    });
  }

  for (const referenceCase of resolutionReferenceCases) {
    test(`rejects dangling resolution ${referenceCase.name} after import`, () => {
      // Given
      const base = legacyCampaign();
      const resolution = base.resolutions[0];
      const validProvinceId = base.provinces[0]?.id;
      if (resolution === undefined || validProvinceId === undefined) {
        throw new RangeError("TEST_SCENARIO_INCOMPLETE");
      }
      const state = {
        ...base,
        resolutions: [referenceCase.mutate(resolution, validProvinceId)],
      };
      const imported = importCampaignExport({
        json: serializeCampaignExport({ scenario, state }),
        expectedScenario: scenario,
      });

      // When
      const parse = () => parseCampaignState(imported.state);

      // Then
      expect(parse).toThrow("CAMPAIGN_PROVINCE_REFERENCE_NOT_FOUND");
    });
  }

  test("imports a v1 state with its raw hash and reports the migration", () => {
    // Given
    const v1State: Record<string, unknown> = {
      ...createCampaignState("scn_ea1900", "nat_kor"),
      lastPlan: planWithIntent(
        "playerIntents",
        {
          type: "territory.transfer",
          actorNationId: "nat_kor",
          provinceId: "prv_jpn_kanto",
          fromNationId: "nat_jpn",
          toNationId: "nat_kor",
          reasonKo: "직접 할양",
        },
        1,
      ),
    };
    Reflect.deleteProperty(v1State, "schemaVersion");
    const serialized = serializeCampaignExport({ scenario, state: v1State });

    // When
    const imported = importCampaignExport({ json: serialized, expectedScenario: scenario });
    const parsed = parseCampaignState(imported.state);

    // Then
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.lastPlan?.schemaVersion).toBe(2);
    expect(parsed.lastPlan?.playerIntents[0]?.type).toBe("territory.transfer");
    expect(imported.migratedFrom).toBe(1);
  });

  test("rejects a tampered v1 state before migration", () => {
    // Given
    const v1State = { ...createCampaignState("scn_ea1900", "nat_kor") };
    Reflect.deleteProperty(v1State, "schemaVersion");
    const exported = JSON.parse(serializeCampaignExport({ scenario, state: v1State })) as {
      readonly state: Record<string, unknown>;
    };
    const tamperedState = { ...exported.state, turn: 99 };
    const tampered = JSON.stringify({ ...exported, state: tamperedState });

    // When
    const importTampered = () =>
      importCampaignExport({ json: tampered, expectedScenario: scenario });

    // Then
    expect(importTampered).toThrow("STATE_HASH_MISMATCH");
  });

  test("normalizes every new collection and legacy chat field", () => {
    const parsed = parseCampaignState(legacyCampaign());
    const resolution = parsed.resolutions[0];
    const message = parsed.chatMessages[0];

    expect(Reflect.get(parsed, "constructionProjects")).toEqual([]);
    expect(Reflect.get(parsed, "worldEvents")).toEqual([]);
    expect(Reflect.get(parsed, "nationReactions")).toEqual([]);
    expect(Reflect.get(parsed, "lastProgression")).toBeNull();
    expect(Reflect.get(resolution ?? {}, "worldEventIds")).toEqual([]);
    expect(Reflect.get(resolution ?? {}, "reactionIds")).toEqual([]);
    expect(Reflect.get(message ?? {}, "participantNationIds")).toEqual(["nat_kor", "nat_jpn"]);
    expect(Reflect.get(message ?? {}, "roomId")).toBe("nat_jpn:general");
    expect(Reflect.get(message ?? {}, "sequence")).toBe(0);
  });

  test("round-trips normalized world records with an exact state hash", () => {
    const legacy = legacyCampaign();
    const firstUnit = legacy.units[0];
    if (firstUnit === undefined) throw new RangeError("TEST_SCENARIO_INCOMPLETE");
    const reactionIds = ["rct_evt_1_1_nat_kor", "rct_evt_1_1_nat_jpn"];
    const enriched = {
      ...legacy,
      nations: legacy.nations.map((nation, index) =>
        index === 0
          ? {
              ...nation,
              governmentKo: "입헌군주제",
              tags: ["reformist"],
              manpowerPool: 10_000,
              profile: {
                goalsKo: ["자주독립"],
                personalityKo: "신중한 개혁가",
                rivalNationIds: ["nat_jpn"],
                allyNationIds: ["nat_gbr"],
              },
            }
          : nation,
      ),
      provinces: legacy.provinces.map((province, index) =>
        index === 0
          ? {
              ...province,
              nameKo: "한성",
              adjacentProvinceIds: ["prv_kor_jeolla"],
              isCapital: true,
              isPort: false,
              terrain: "plains",
              developmentBps: 5_000,
            }
          : province,
      ),
      constructionProjects: [
        {
          id: "cst_1_1",
          ownerNationId: "nat_kor",
          provinceId: "prv_kor_hanseong",
          kind: "rail",
          investedCredits: 50,
          startedTurn: 1,
          status: "active",
        },
      ],
      worldEvents: [
        {
          id: "evt_1_1",
          kind: "economic",
          importance: "minor",
          occurredAtElapsedDays: 30,
          turn: 1,
          date: { year: 1900, quarter: 1 },
          actorNationIds: ["nat_kor"],
          affectedNationIds: ["nat_kor", "nat_jpn"],
          headlineKo: "한성 철도 계획 발표",
          summaryKo: "조선의 철도 투자가 동아시아 경제에 영향을 주었다.",
          sourceResolutionId: "res_1_1",
          impacts: {
            regionTransfers: [
              {
                regionId: "prv_kor_hanseong",
                fromNationId: "nat_jpn",
                toNationId: "nat_kor",
                sourceEventId: "evt_1_1",
              },
            ],
            nationChanges: [],
            relationChanges: [],
            unitOps: [
              {
                op: "spawn",
                ownerNationId: "nat_kor",
                provinceId: "prv_kor_hanseong",
                manpower: 500,
              },
              {
                op: "move",
                unitId: firstUnit.id,
                provinceId: "prv_kor_jeolla",
              },
            ],
          },
          provenance: "player_divergence",
          regionIds: ["prv_kor_hanseong"],
          sourceInputIds: ["req_1"],
        },
      ],
      nationReactions: [
        {
          id: reactionIds[0],
          worldEventId: "evt_1_1",
          nationId: "nat_kor",
          stance: "supportive",
          sentimentBps: 500,
          statementKo: "철도 투자는 국가 발전의 기반이 될 것입니다.",
        },
        {
          id: reactionIds[1],
          worldEventId: "evt_1_1",
          nationId: "nat_jpn",
          stance: "cautious",
          sentimentBps: 100,
          statementKo: "지역 통상에 미칠 영향을 면밀히 살피겠습니다.",
        },
      ],
      lastProgression: {
        mode: "months",
        advanceDays: 30,
        steps: 1,
        stopReason: "requested_duration",
      },
      lastPlan: planWithIntent("playerIntents", {
        type: "territory.transfer",
        actorNationId: "nat_kor",
        provinceId: "prv_jpn_kanto",
        fromNationId: "nat_jpn",
        toNationId: "nat_kor",
        reasonKo: "직접 할양",
      }),
      resolutions: legacy.resolutions.map((resolution) => ({
        ...resolution,
        unitDeltas: [
          {
            unitId: firstUnit.id,
            ownerNationId: firstUnit.ownerNationId,
            before: {
              ownerNationId: firstUnit.ownerNationId,
              provinceId: firstUnit.provinceId,
              manpower: firstUnit.manpower,
            },
            after: {
              ownerNationId: firstUnit.ownerNationId,
              provinceId: "prv_jpn_kanto",
              manpower: firstUnit.manpower,
            },
            source: "policy",
          },
        ],
        worldEventIds: ["evt_1_1"],
        reactionIds,
        worldImpact: {
          ...resolution.worldImpact,
          changedProvinceIds: ["prv_jpn_kanto"],
          regionOwnershipOverrides: [
            {
              regionId: "prv_jpn_kanto",
              fromNationId: "nat_jpn",
              toNationId: "nat_kor",
              reasonKo: "직접 할양",
              cause: "player",
              source: "policy",
            },
          ],
        },
      })),
    };

    const parsed = parseCampaignState(enriched);
    const serialized = serializeCampaignExport({ scenario, state: parsed });
    const imported = importCampaignExport({
      json: serialized,
      expectedScenario: scenario,
    });
    const restored = parseCampaignState(imported.state);

    expect(restored).toEqual(parsed);
    expect(hashCanonical(restored)).toBe(hashCanonical(parsed));
    expect(
      hashCanonical({ ...parsed, nationReactions: [...parsed.nationReactions].reverse() }),
    ).not.toBe(hashCanonical(parsed));
    const restoredResolution = restored.resolutions[0];
    if (restoredResolution === undefined) {
      throw new RangeError("RESTORED_RESOLUTION_MISSING");
    }
    expect(CampaignResolutionSchema.safeParse(restoredResolution).success).toBe(true);
  });
});
