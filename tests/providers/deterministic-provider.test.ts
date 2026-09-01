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
      },
      {
        type: "diplomacy.propose_treaty",
        actorNationId: "nat_kor",
        recipientNationId: "nat_jpn",
        clauses: ["trade"],
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
    expect(plan.playerIntents).toEqual([]);
    expect(plan.npcIntents.length).toBe(3);
    expect(plan.warnings).toEqual(["PLAYER_ORDER_NOT_RECOGNIZED"]);
  });
});
