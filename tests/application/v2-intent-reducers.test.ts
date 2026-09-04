import { describe, expect, test } from "bun:test";

import { applyStrategicPlan } from "../../src/application/apply-strategic-plan";
import {
  type CampaignState,
  createCampaignState,
  parseCampaignState,
} from "../../src/application/campaign-state";
import type { StrategicIntent, StrategicPlan } from "../../src/providers/schemas";
import { canonicalStringify } from "../../src/shared/canonical-json";

const planWith = (intent: StrategicIntent): StrategicPlan => ({
  schemaVersion: 2,
  requestId: "req_v2_reducer",
  playerIntents: [intent],
  npcIntents: [],
  narrative: { ko: "명령이 처리되었다." },
  warnings: [],
});

const applyNpc = (snapshot: CampaignState, intent: StrategicIntent): CampaignState =>
  applyStrategicPlan({
    snapshot,
    plan: { ...planWith(intent), playerIntents: [], npcIntents: [intent] },
    orderText: "NPC intent",
  });

const apply = (snapshot: CampaignState, intent: StrategicIntent): CampaignState =>
  applyStrategicPlan({ snapshot, plan: planWith(intent), orderText: "명령을 실행한다." });

const withTreaty = (status: "proposed" | "active" = "proposed"): CampaignState =>
  parseCampaignState({
    ...createCampaignState("scn_ea1900", "nat_kor"),
    treaties: [
      {
        id: "try_0_0",
        proposerNationId: "nat_kor",
        recipientNationId: "nat_jpn",
        clauses: ["trade"],
        status,
        proposedTurn: 0,
      },
    ],
  });

const withWar = (): CampaignState =>
  parseCampaignState({
    ...createCampaignState("scn_ea1900", "nat_kor"),
    wars: [
      {
        id: "war_0_0",
        attackerNationId: "nat_kor",
        targetNationId: "nat_qing",
        status: "active",
        declaredTurn: 0,
      },
    ],
  });

describe("v2 strategic intent reducers", () => {
  test("reduces player intents before NPC intents", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");
    const plan: StrategicPlan = {
      schemaVersion: 2,
      requestId: "req_player_before_npc",
      playerIntents: [
        {
          type: "nation.adjust",
          nationId: "nat_kor",
          treasuryDelta: 10_000,
          reasonKo: "플레이어 지원",
        },
      ],
      npcIntents: [
        {
          type: "nation.adjust",
          nationId: "nat_kor",
          treasuryDelta: 10_000,
          reasonKo: "NPC 지원",
        },
      ],
      narrative: { ko: "두 정책이 차례로 처리되었다." },
      warnings: [],
    };

    // When
    const after = applyStrategicPlan({ snapshot, plan, orderText: "정책을 순서대로 처리한다." });

    // Then
    expect(after.nations.find((nation) => nation.id === "nat_kor")?.treasuryCredits).toBe(345);
    expect(after.events.slice(0, 2)).toEqual([
      expect.stringContaining("플레이어 지원"),
      expect.stringContaining("NPC 지원"),
    ]);
  });

  test("nation.adjust clamps deltas and records policy sources", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const after = apply(snapshot, {
      type: "nation.adjust",
      nationId: "nat_kor",
      treasuryDelta: 10_000,
      gdpDelta: 10_000,
      stabilityDelta: 10_000,
      taxRateBps: 2_000,
      reasonKo: "긴급 재정 조정",
    });
    const nation = after.nations.find((candidate) => candidate.id === "nat_kor");
    const delta = after.resolutions.at(-1)?.nationDeltas[0];

    // Then
    expect(nation).toEqual(
      expect.objectContaining({ treasuryCredits: 288, gdpCredits: 1_440, stabilityBps: 6_960 }),
    );
    expect(delta?.treasuryCredits.source).toBe("policy");
    expect(delta?.stabilityBps?.source).toBe("policy");
    expect(after.events.some((event) => event.includes("긴급 재정 조정"))).toBe(true);
  });

  test("rejects player treasury and stability debits at the reducer boundary", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const debit = () =>
      apply(snapshot, {
        type: "nation.adjust",
        nationId: "nat_kor",
        treasuryDelta: -1,
        stabilityDelta: -1,
        reasonKo: "플레이어 자원 차감",
      });

    // Then
    expect(debit).toThrow("PLAYER_SOVEREIGNTY_VIOLATION");
  });

  test("allows an NPC intent to debit the player within normal clamps", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const after = applyNpc(snapshot, {
      type: "nation.adjust",
      nationId: "nat_kor",
      treasuryDelta: -10_000,
      stabilityDelta: -10_000,
      reasonKo: "NPC가 부과한 손실",
    });

    // Then
    expect(after.nations.find((nation) => nation.id === "nat_kor")).toEqual(
      expect.objectContaining({ treasuryCredits: 192, stabilityBps: 4_640 }),
    );
  });

  test("rejects an NPC economy intent acting as the player", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");
    const beforeBytes = canonicalStringify(snapshot);

    // When
    const spoof = () =>
      applyNpc(snapshot, {
        type: "economy.invest",
        actorNationId: "nat_kor",
        provinceId: "prv_kor_hanseong",
        sector: "rail",
        budgetCredits: 20,
      });

    // Then
    expect(spoof).toThrow("INTENT_ACTOR_INVALID");
    expect(canonicalStringify(snapshot)).toBe(beforeBytes);
  });

  test("relation.adjust changes only the directed relation", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");
    const reverseBefore = snapshot.relations.find(
      (relation) => relation.fromNationId === "nat_jpn" && relation.toNationId === "nat_kor",
    )?.value;
    const forwardBefore = snapshot.relations.find(
      (relation) => relation.fromNationId === "nat_kor" && relation.toNationId === "nat_jpn",
    )?.value;

    // When
    const after = apply(snapshot, {
      type: "relation.adjust",
      fromNationId: "nat_kor",
      toNationId: "nat_jpn",
      delta: -3_000,
      reasonKo: "외교 갈등",
    });

    // Then
    expect(
      after.relations.find(
        (relation) => relation.fromNationId === "nat_kor" && relation.toNationId === "nat_jpn",
      )?.value,
    ).toBe((forwardBefore ?? 0) - 3_000);
    expect(
      after.relations.find(
        (relation) => relation.fromNationId === "nat_jpn" && relation.toNationId === "nat_kor",
      )?.value,
    ).toBe(reverseBefore);
  });

  test("rejects an NPC relation intent spoofing the player as its initiator", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const spoof = () =>
      applyNpc(snapshot, {
        type: "relation.adjust",
        fromNationId: "nat_kor",
        toNationId: "nat_jpn",
        delta: -1_000,
        reasonKo: "플레이어 명의의 관계 악화",
      });

    // Then
    expect(spoof).toThrow("INTENT_ACTOR_INVALID");
  });

  test("rejects an NPC territory intent spoofing the previous owner", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const spoof = () =>
      applyNpc(snapshot, {
        type: "territory.transfer",
        actorNationId: "nat_jpn",
        provinceId: "prv_kor_hanseong",
        fromNationId: "nat_kor",
        toNationId: "nat_jpn",
        reasonKo: "위조된 영토 양도",
      });

    // Then
    expect(spoof).toThrow("INTENT_ACTOR_INVALID");
  });

  test("treaty.respond lets only the recipient accept or reject a proposal", () => {
    // Given
    const proposed = withTreaty();

    // When
    const accepted = applyNpc(proposed, {
      type: "treaty.respond",
      treatyId: "try_0_0",
      decision: "accept",
      actorNationId: "nat_jpn",
    });
    const rejected = applyNpc(proposed, {
      type: "treaty.respond",
      treatyId: "try_0_0",
      decision: "reject",
      actorNationId: "nat_jpn",
    });

    // Then
    expect(accepted.treaties[0]).toEqual(
      expect.objectContaining({ status: "active", resolvedTurn: 1 }),
    );
    expect(rejected.treaties[0]).toEqual(
      expect.objectContaining({ status: "rejected", resolvedTurn: 1 }),
    );
    expect(() =>
      apply(proposed, {
        type: "treaty.respond",
        treatyId: "try_0_0",
        decision: "accept",
        actorNationId: "nat_kor",
      }),
    ).toThrow();
  });

  test("treaty.terminate ends an active treaty and penalizes the actor relation", () => {
    // Given
    const snapshot = withTreaty("active");
    const relationBefore = snapshot.relations.find(
      (relation) => relation.fromNationId === "nat_kor" && relation.toNationId === "nat_jpn",
    )?.value;

    // When
    const after = apply(snapshot, {
      type: "treaty.terminate",
      treatyId: "try_0_0",
      actorNationId: "nat_kor",
      reasonKo: "협정 의무 위반",
    });

    // Then
    expect(after.treaties[0]).toEqual(
      expect.objectContaining({ status: "terminated", terminatedTurn: 1 }),
    );
    expect(
      after.relations.find(
        (relation) => relation.fromNationId === "nat_kor" && relation.toNationId === "nat_jpn",
      )?.value,
    ).toBe((relationBefore ?? 0) - 1_500);
  });

  test("war.declare creates a stable active war and changes both relations", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");
    const forwardBefore = snapshot.relations.find(
      (relation) => relation.fromNationId === "nat_kor" && relation.toNationId === "nat_jpn",
    )?.value;
    const reverseBefore = snapshot.relations.find(
      (relation) => relation.fromNationId === "nat_jpn" && relation.toNationId === "nat_kor",
    )?.value;

    // When
    const after = apply(snapshot, {
      type: "war.declare",
      actorNationId: "nat_kor",
      targetNationId: "nat_jpn",
      casusBelliKo: "국경 침범",
    });

    // Then
    expect(after.wars[0]).toEqual({
      id: "war_1_0",
      attackerNationId: "nat_kor",
      targetNationId: "nat_jpn",
      status: "active",
      declaredTurn: 1,
    });
    expect(
      after.relations.find(
        (relation) => relation.fromNationId === "nat_kor" && relation.toNationId === "nat_jpn",
      )?.value,
    ).toBe((forwardBefore ?? 0) - 4_000);
    expect(
      after.relations.find(
        (relation) => relation.fromNationId === "nat_jpn" && relation.toNationId === "nat_kor",
      )?.value,
    ).toBe((reverseBefore ?? 0) - 4_000);
    expect(after.events.some((event) => event.includes("국경 침범"))).toBe(true);
  });

  test("war.peace applies valid terms and rolls back every invalid multi-term peace", () => {
    // Given
    const snapshot = withWar();
    const validTerm = {
      type: "territory.transfer" as const,
      actorNationId: "nat_kor",
      provinceId: "prv_qing_manchuria",
      fromNationId: "nat_qing",
      toNationId: "nat_kor",
      reasonKo: "강화 조약",
    };
    const beforeBytes = canonicalStringify(snapshot);

    // When
    const ended = apply(snapshot, {
      type: "war.peace",
      actorNationId: "nat_kor",
      warId: "war_0_0",
      terms: [validTerm],
      reparationsCredits: 10,
    });
    const invalid = () =>
      apply(snapshot, {
        type: "war.peace",
        actorNationId: "nat_kor",
        warId: "war_0_0",
        terms: [validTerm, { ...validTerm, provinceId: "prv_jpn_kanto", fromNationId: "nat_qing" }],
      });

    // Then
    expect(ended.wars[0]).toEqual(expect.objectContaining({ status: "ended", endedTurn: 1 }));
    expect(
      String(
        ended.provinces.find((province) => province.id === "prv_qing_manchuria")?.ownerNationId,
      ),
    ).toBe("nat_kor");
    expect(ended.nations.find((nation) => nation.id === "nat_kor")?.treasuryCredits).toBe(250);
    expect(invalid).toThrow();
    expect(canonicalStringify(snapshot)).toBe(beforeBytes);
  });

  test("rejects peace by a player who is not a party to the war", () => {
    // Given
    const snapshot = parseCampaignState({
      ...createCampaignState("scn_ea1900", "nat_kor"),
      wars: [
        {
          id: "war_0_0",
          attackerNationId: "nat_jpn",
          targetNationId: "nat_qing",
          status: "active",
          declaredTurn: 0,
        },
      ],
    });

    // When
    const settleUnrelatedWar = () =>
      apply(snapshot, {
        type: "war.peace",
        actorNationId: "nat_kor",
        warId: "war_0_0",
        terms: [],
      });

    // Then
    expect(settleUnrelatedWar).toThrow("WAR_ACTOR_NOT_PARTY");
  });

  test("rejects peace terms that surrender player territory", () => {
    // Given
    const snapshot = withWar();

    // When
    const surrender = () =>
      apply(snapshot, {
        type: "war.peace",
        actorNationId: "nat_kor",
        warId: "war_0_0",
        terms: [
          {
            type: "territory.transfer",
            actorNationId: "nat_kor",
            provinceId: "prv_kor_hanseong",
            fromNationId: "nat_kor",
            toNationId: "nat_qing",
            reasonKo: "플레이어 영토 할양",
          },
        ],
      });

    // Then
    expect(surrender).toThrow("PLAYER_TERRITORY_SURRENDER");
  });

  test("unit.move moves adjacently and converts a non-adjacent move to action.fail", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const moved = apply(snapshot, {
      type: "unit.move",
      actorNationId: "nat_kor",
      unitId: "unt_ea1900_kor_1",
      toProvinceId: "prv_kor_gyeonggi",
    });
    const failed = apply(snapshot, {
      type: "unit.move",
      actorNationId: "nat_kor",
      unitId: "unt_ea1900_kor_1",
      toProvinceId: "prv_jpn_kanto",
    });

    // Then
    expect(moved.units.find((unit) => unit.id === "unt_ea1900_kor_1")?.provinceId).toBe(
      "prv_kor_gyeonggi",
    );
    expect(failed.units.find((unit) => unit.id === "unt_ea1900_kor_1")?.provinceId).toBe(
      "prv_kor_hanseong",
    );
    expect(failed.nations.find((nation) => nation.id === "nat_kor")?.stabilityBps).toBe(5_700);
    expect(failed.events.some((event) => event.includes("실패"))).toBe(true);
  });

  test("unit.attack resolves seeded combat and transfers only an attacker victory", () => {
    // Given
    const base = withWar();
    const snapshot = parseCampaignState({
      ...base,
      units: base.units.map((unit) =>
        unit.id === "unt_ea1900_kor_2"
          ? { ...unit, manpower: 100_000 }
          : unit.id === "unt_ea1900_qing_2"
            ? { ...unit, manpower: 100 }
            : unit,
      ),
    });

    // When
    const after = apply(snapshot, {
      type: "unit.attack",
      actorNationId: "nat_kor",
      unitId: "unt_ea1900_kor_2",
      targetProvinceId: "prv_qing_manchuria",
    });

    // Then
    expect(
      String(
        after.provinces.find((province) => province.id === "prv_qing_manchuria")?.ownerNationId,
      ),
    ).toBe("nat_kor");
    expect(after.units.find((unit) => unit.id === "unt_ea1900_kor_2")?.provinceId).toBe(
      "prv_qing_manchuria",
    );
    expect(after.battleReports).toHaveLength(1);

    const defeated = apply(base, {
      type: "unit.attack",
      actorNationId: "nat_kor",
      unitId: "unt_ea1900_kor_2",
      targetProvinceId: "prv_qing_manchuria",
    });
    expect(
      String(
        defeated.provinces.find((province) => province.id === "prv_qing_manchuria")?.ownerNationId,
      ),
    ).toBe("nat_qing");
  });

  test("unit.disband removes only an owned unit", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const after = apply(snapshot, {
      type: "unit.disband",
      actorNationId: "nat_kor",
      unitId: "unt_ea1900_kor_1",
    });

    // Then
    expect(after.units.some((unit) => unit.id === "unt_ea1900_kor_1")).toBe(false);
    expect(() =>
      apply(snapshot, {
        type: "unit.disband",
        actorNationId: "nat_kor",
        unitId: "unt_ea1900_jpn_1",
      }),
    ).toThrow();
  });

  test("rejects NPC move and attack against player units", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");
    const attempts = [
      () =>
        applyNpc(snapshot, {
          type: "unit.move",
          actorNationId: "nat_jpn",
          unitId: "unt_ea1900_kor_1",
          toProvinceId: "prv_kor_gyeonggi",
        }),
      () =>
        applyNpc(withWar(), {
          type: "unit.attack",
          actorNationId: "nat_jpn",
          unitId: "unt_ea1900_kor_2",
          targetProvinceId: "prv_qing_manchuria",
        }),
    ];

    // When / Then
    for (const attempt of attempts) expect(attempt).toThrow("UNIT_NOT_OWNED");
  });

  test("rejects an NPC actor spoofing authority over an unrelated nation's unit", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const disband = () =>
      applyNpc(snapshot, {
        type: "unit.disband",
        actorNationId: "nat_jpn",
        unitId: "unt_ea1900_qing_1",
      });

    // Then
    expect(disband).toThrow("UNIT_NOT_OWNED");
  });

  test("polity.change updates identity only when the new capital is owned", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const after = apply(snapshot, {
      type: "polity.change",
      nationId: "nat_kor",
      nameKo: "대한연방",
      governmentKo: "입헌군주제",
      capitalProvinceId: "prv_kor_gyeonggi",
    });

    // Then
    expect(after.nations.find((nation) => nation.id === "nat_kor")).toEqual(
      expect.objectContaining({
        nameKo: "대한연방",
        governmentKo: "입헌군주제",
        capitalProvinceId: "prv_kor_gyeonggi",
      }),
    );
    expect(() =>
      apply(snapshot, {
        type: "polity.change",
        nationId: "nat_kor",
        capitalProvinceId: "prv_jpn_kanto",
      }),
    ).toThrow();
  });

  test("action.fail applies its bounded loss without aborting the plan", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const after = apply(snapshot, {
      type: "action.fail",
      actorNationId: "nat_kor",
      attemptKo: "실패한 비밀 공작",
      stabilityDelta: -500,
    });

    // Then
    expect(after.nations.find((nation) => nation.id === "nat_kor")?.stabilityBps).toBe(5_300);
    expect(after.events.some((event) => event.includes("실패한 비밀 공작"))).toBe(true);
  });
});
