import { describe, expect, test } from "bun:test";

import { planDeterministically } from "../../src/providers/deterministic-provider";
import { parseStrategicPlan } from "../../src/providers/schemas";

describe("deterministic strategy provider", () => {
  test("translates the Korean rail and trade order into typed intents", () => {
    // Given
    const input = {
      requestId: "req_0000000000000001",
      orderText: "철도망을 확장하고 일본에 통상 협정을 제안한다",
      turn: 0,
    };

    // When
    const plan = parseStrategicPlan(planDeterministically(input));

    // Then
    expect(plan.playerIntents).toEqual([
      {
        type: "economy.invest",
        actorNationId: "nat_kor",
        provinceId: "prv_kor_hanseong",
        sector: "rail",
        budgetCredits: 25,
        sourceQuoteKo: "철도",
      },
      {
        type: "diplomacy.propose_treaty",
        actorNationId: "nat_kor",
        recipientNationId: "nat_jpn",
        clauses: ["trade"],
        sourceQuoteKo: "통상",
      },
    ]);
    expect(plan.npcIntents.length).toBeGreaterThan(0);
    expect(plan.narrative.ko).toContain("철도");
  });

  test("keeps an unknown order valid without inventing IDs", () => {
    // Given
    const input = {
      requestId: "req_0000000000000002",
      orderText: "전혀 알려지지 않은 계획",
      turn: 4,
    };

    // When
    const plan = parseStrategicPlan(planDeterministically(input));

    // Then
    expect(plan.playerIntents).toEqual([
      {
        type: "action.fail",
        actorNationId: "nat_kor",
        attemptKo: input.orderText,
        stabilityDelta: -100,
        sourceQuoteKo: input.orderText,
      },
    ]);
    expect(plan.npcIntents.length).toBe(3);
    expect(plan.warnings).toEqual([]);
  });

  test("maps a generic Korean construction order to a fixed sector", () => {
    // Given
    const input = {
      requestId: "req_0000000000000003",
      orderText: "제주에 공항을 건설한다",
      turn: 0,
    };

    // When
    const plan = parseStrategicPlan(planDeterministically(input));

    // Then
    expect(plan.playerIntents).toEqual([
      {
        type: "economy.invest",
        actorNationId: "nat_kor",
        provinceId: "prv_kor_hanseong",
        sector: "airport",
        budgetCredits: 25,
        sourceQuoteKo: input.orderText,
      },
    ]);
  });

  test("chooses profile-driven actions for every major nation", () => {
    // Given
    const majorNationIds = ["nat_jpn", "nat_qing", "nat_rus", "nat_usa"];
    const stateJson = JSON.stringify({
      majorNations: [
        {
          id: "nat_jpn",
          treasuryCredits: 100,
          tags: ["expansionist"],
          profile: { goalsKo: ["대륙 영향력 확대"] },
        },
        {
          id: "nat_qing",
          treasuryCredits: 500,
          tags: [],
          profile: { goalsKo: ["산업 기반 확충"] },
        },
        {
          id: "nat_rus",
          treasuryCredits: 100,
          tags: [],
          profile: { goalsKo: ["극동 영향력 유지"] },
        },
        {
          id: "nat_usa",
          treasuryCredits: 100,
          tags: ["reformist"],
          profile: { goalsKo: ["국내 개혁 추진"] },
        },
      ],
      provinces: [
        { id: "prv_jpn_kanto", ownerNationId: "nat_jpn" },
        { id: "prv_qing_zhili", ownerNationId: "nat_qing" },
        { id: "prv_rus_primorye", ownerNationId: "nat_rus" },
        { id: "prv_usa_washington", ownerNationId: "nat_usa" },
      ],
      relations: [{ fromNationId: "nat_rus", toNationId: "nat_jpn", value: -3_000 }],
      wars: [{ attackerNationId: "nat_jpn", targetNationId: "nat_deu", declaredTurn: 0 }],
      units: [],
    });

    // When
    const plan = parseStrategicPlan(
      planDeterministically({
        requestId: "req_0000000000000004",
        orderText: "철도를 확장한다",
        turn: 0,
        stateJson,
      }),
    );

    // Then
    for (const nationId of majorNationIds) {
      expect(
        plan.npcIntents.some(
          (intent) =>
            ("actorNationId" in intent && intent.actorNationId === nationId) ||
            ("nationId" in intent && intent.nationId === nationId) ||
            ("fromNationId" in intent && intent.fromNationId === nationId),
        ),
      ).toBe(true);
    }
    expect(plan.npcIntents).toContainEqual({
      type: "military.recruit",
      actorNationId: "nat_jpn",
      provinceId: "prv_jpn_kanto",
      manpower: 2_000,
    });
    expect(plan.npcIntents).toContainEqual({
      type: "economy.invest",
      actorNationId: "nat_qing",
      provinceId: "prv_qing_zhili",
      sector: "industry",
      budgetCredits: 40,
    });
    expect(plan.npcIntents).toContainEqual({
      type: "relation.adjust",
      fromNationId: "nat_rus",
      toNationId: "nat_jpn",
      delta: -250,
      reasonKo: "적대 관계에 대응해 외교적 압박을 강화했다.",
    });
    expect(plan.npcIntents).toContainEqual({
      type: "nation.adjust",
      nationId: "nat_usa",
      stabilityDelta: 100,
      reasonKo: "개혁 정책을 추진해 국내 안정을 높였다.",
    });
  });
});
