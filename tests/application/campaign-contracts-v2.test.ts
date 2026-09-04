import { describe, expect, test } from "bun:test";

import {
  CampaignResolutionSchema,
  createCampaignResolution,
} from "../../src/application/campaign-resolution";
import { createCampaignState, parseCampaignState } from "../../src/application/campaign-state";

describe("campaign v2 state contracts", () => {
  test("derives capitals and accepts complete treaty and war lifecycles", () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const parsed = parseCampaignState({
      ...base,
      treaties: [
        {
          id: "try_1_0",
          proposerNationId: "nat_kor",
          recipientNationId: "nat_jpn",
          clauses: ["trade"],
          status: "rejected",
          proposedTurn: 1,
          resolvedTurn: 2,
        },
        {
          id: "try_2_0",
          proposerNationId: "nat_kor",
          recipientNationId: "nat_qing",
          clauses: ["trade"],
          status: "terminated",
          proposedTurn: 1,
          resolvedTurn: 2,
          terminatedTurn: 3,
        },
      ],
      wars: [
        {
          id: "war_2_0",
          attackerNationId: "nat_kor",
          targetNationId: "nat_jpn",
          status: "ended",
          declaredTurn: 2,
          endedTurn: 3,
        },
      ],
    });

    // Then
    expect(base.nations.find((nation) => nation.id === "nat_kor")?.capitalProvinceId).toBe(
      "prv_kor_hanseong",
    );
    expect(parsed.treaties.map((treaty) => treaty.status)).toEqual(["rejected", "terminated"]);
    expect(parsed.wars[0]).toEqual({
      id: "war_2_0",
      attackerNationId: "nat_kor",
      targetNationId: "nat_jpn",
      status: "ended",
      declaredTurn: 2,
      endedTurn: 3,
    });
  });

  test("migrates legacy wars and defaults old resolution sources to policy", () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const changed = {
      ...base,
      nations: base.nations.map((nation) =>
        nation.id === "nat_kor"
          ? { ...nation, treasuryCredits: nation.treasuryCredits - 1 }
          : nation,
      ),
      relations: base.relations.map((relation, index) =>
        index === 0 ? { ...relation, value: relation.value - 1 } : relation,
      ),
      treaties: [
        {
          id: "try_1_0",
          proposerNationId: "nat_kor",
          recipientNationId: "nat_jpn",
          clauses: ["trade"],
          status: "proposed" as const,
          proposedTurn: 1,
        },
      ],
    };
    const legacyResolution = JSON.parse(
      JSON.stringify(
        createCampaignResolution({
          before: base,
          after: changed,
          turn: 1,
          cadence: "quarter",
          advanceDays: 91,
          orderText: "정책을 시행한다.",
          narrativeKo: "정책이 시행되었다.",
          changedProvinceIds: [],
        }),
      ),
    );
    Reflect.deleteProperty(legacyResolution.nationDeltas[0].treasuryCredits, "source");
    Reflect.deleteProperty(legacyResolution.nationDeltas[0].gdpCredits, "source");
    Reflect.deleteProperty(legacyResolution.nationDeltas[0].infrastructureBps, "source");
    Reflect.deleteProperty(legacyResolution.relationDeltas[0], "source");
    Reflect.deleteProperty(legacyResolution.treatyDeltas[0], "source");
    Reflect.deleteProperty(legacyResolution, "unitDeltas");

    // When
    const parsed = parseCampaignState({
      ...base,
      wars: [{ attackerNationId: "nat_kor", targetNationId: "nat_jpn", declaredTurn: 4 }],
      resolutions: [legacyResolution],
    });
    const resolution = parsed.resolutions[0];

    // Then
    expect(parsed.wars[0]).toEqual({
      id: "war_4_0",
      attackerNationId: "nat_kor",
      targetNationId: "nat_jpn",
      status: "active",
      declaredTurn: 4,
    });
    expect(resolution?.nationDeltas[0]?.treasuryCredits.source).toBe("policy");
    expect(resolution?.relationDeltas[0]?.source).toBe("policy");
    expect(resolution?.treatyDeltas[0]?.source).toBe("policy");
    expect(resolution?.unitDeltas).toEqual([]);
  });

  test("records every numeric and entity delta without prose parsing", () => {
    // Given
    const before = parseCampaignState({
      ...createCampaignState("scn_ea1900", "nat_kor"),
      treaties: [
        {
          id: "try_1_0",
          proposerNationId: "nat_kor",
          recipientNationId: "nat_jpn",
          clauses: ["trade"],
          status: "proposed",
          proposedTurn: 1,
        },
      ],
    });
    const removed = before.units[0];
    if (removed === undefined) throw new Error("scenario has no unit");
    const after = parseCampaignState({
      ...before,
      nations: before.nations.map((nation) =>
        nation.id === "nat_kor"
          ? {
              ...nation,
              treasuryCredits: nation.treasuryCredits + 1,
              gdpCredits: nation.gdpCredits + 2,
              infrastructureBps: nation.infrastructureBps + 3,
              stabilityBps: nation.stabilityBps + 4,
              population: nation.population + 5,
              taxRateBps: nation.taxRateBps + 6,
            }
          : nation,
      ),
      treaties: [{ ...before.treaties[0], status: "active", resolvedTurn: 2 }],
      units: [
        ...before.units
          .slice(1)
          .map((unit, index) =>
            index === 0
              ? { ...unit, provinceId: "prv_jpn_kanto", manpower: unit.manpower - 100 }
              : unit,
          ),
        {
          id: "unt_2_99",
          ownerNationId: "nat_kor",
          provinceId: "prv_kor_hanseong",
          manpower: 500,
        },
      ],
    });

    // When
    const resolution = CampaignResolutionSchema.parse(
      createCampaignResolution({
        before,
        after,
        turn: 2,
        cadence: "quarter",
        advanceDays: 91,
        orderText: "국정을 조정한다.",
        narrativeKo: "국정 지표가 조정되었다.",
        changedProvinceIds: [],
      }),
    );
    const nation = resolution.nationDeltas.find((delta) => delta.nationId === "nat_kor");

    // Then
    expect(nation?.stabilityBps).toEqual({ before: 5_800, after: 5_804, source: "policy" });
    expect(nation?.population).toEqual({
      before: 17_082_000,
      after: 17_082_005,
      source: "policy",
    });
    expect(nation?.taxRateBps).toEqual({ before: 1_500, after: 1_506, source: "policy" });
    expect(resolution.treatyDeltas[0]).toEqual(
      expect.objectContaining({ status: "active", resolvedTurn: 2, source: "policy" }),
    );
    expect(resolution.unitDeltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unitId: removed.id, before: expect.any(Object), after: null }),
        expect.objectContaining({
          unitId: "unt_ea1900_jpn_2",
          before: expect.objectContaining({ provinceId: "prv_jpn_tohoku", manpower: 55_000 }),
          after: expect.objectContaining({ provinceId: "prv_jpn_kanto", manpower: 54_900 }),
        }),
        expect.objectContaining({ unitId: "unt_2_99", before: null, after: expect.any(Object) }),
      ]),
    );
  });
});
