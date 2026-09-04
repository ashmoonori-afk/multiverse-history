import { describe, expect, test } from "bun:test";

import { groundStrategicPlan } from "../../src/application/ground-strategic-plan";
import type { StrategicIntent, StrategicPlan } from "../../src/providers/schemas";

const PLAYER = "nat_kor";
const OWNED = "prv_kor_hanseong";
const FOREIGN = "prv_jpn_kanto";

const planWith = (playerIntents: readonly StrategicIntent[]): StrategicPlan => ({
  schemaVersion: 1,
  requestId: "req_grounding",
  playerIntents,
  npcIntents: [
    {
      type: "military.recruit",
      actorNationId: "nat_jpn",
      provinceId: FOREIGN,
      manpower: 2_000,
    },
  ],
  narrative: { ko: "명령이 처리됐다." },
  warnings: [],
});

const ground = (orderText: string, playerIntents: readonly StrategicIntent[]): StrategicPlan =>
  groundStrategicPlan({
    plan: planWith(playerIntents),
    orderText,
    playerNationId: PLAYER,
    playerProvinceIds: [OWNED],
  });

describe("strategic plan grounding", () => {
  test("keeps an order the engine has no keyword for when the model quotes it", () => {
    // Given an order about a harbour - a word no engine keyword list contains
    const orderText = "한성에 근대식 항구를 건설하라";
    const intent: StrategicIntent = {
      type: "economy.invest",
      actorNationId: PLAYER,
      provinceId: OWNED,
      sector: "port",
      budgetCredits: 60,
      sourceQuoteKo: "근대식 항구를 건설하라",
    };

    // When
    const grounded = ground(orderText, [intent]);

    // Then
    expect(grounded.playerIntents).toEqual([intent]);
    expect(grounded.warnings).not.toContain("PLAYER_INTENT_UNGROUNDED");
  });

  test("keeps an airfield order the same way", () => {
    // Given
    const orderText = "한성 외곽에 비행장을 세워라";
    const intent: StrategicIntent = {
      type: "economy.invest",
      actorNationId: PLAYER,
      provinceId: OWNED,
      sector: "airfield",
      budgetCredits: 45,
      sourceQuoteKo: "비행장을 세워라",
    };

    // When
    const grounded = ground(orderText, [intent]);

    // Then
    expect(grounded.playerIntents).toHaveLength(1);
    expect(grounded.playerIntents[0]?.type).toBe("economy.invest");
  });

  test("drops an intent whose quote never appears in the order", () => {
    // Given the model invented a justification the player never wrote
    const orderText = "한성에 근대식 항구를 건설하라";
    const fabricated: StrategicIntent = {
      type: "military.recruit",
      actorNationId: PLAYER,
      provinceId: OWNED,
      manpower: 50_000,
      sourceQuoteKo: "전군을 동원하라",
    };

    // When
    const grounded = ground(orderText, [fabricated]);

    // Then
    expect(grounded.playerIntents).toEqual([]);
    expect(grounded.warnings).toContain("PLAYER_INTENT_UNGROUNDED");
  });

  test("drops an intent that quotes the order but targets a province the player does not own", () => {
    // Given a legal-looking quote pointed at foreign territory
    const orderText = "간토에 항구를 건설하라";
    const illegal: StrategicIntent = {
      type: "economy.invest",
      actorNationId: PLAYER,
      provinceId: FOREIGN,
      sector: "port",
      budgetCredits: 60,
      sourceQuoteKo: "항구를 건설하라",
    };

    // When
    const grounded = ground(orderText, [illegal]);

    // Then
    expect(grounded.playerIntents).toEqual([]);
    expect(grounded.warnings).toContain("PLAYER_INTENT_UNGROUNDED");
  });

  test("drops an intent whose actor is not the player", () => {
    // Given
    const orderText = "항구를 건설하라";
    const impostor: StrategicIntent = {
      type: "economy.invest",
      actorNationId: "nat_jpn",
      provinceId: OWNED,
      sector: "port",
      budgetCredits: 60,
      sourceQuoteKo: "항구를 건설하라",
    };

    // When
    const grounded = ground(orderText, [impostor]);

    // Then
    expect(grounded.playerIntents).toEqual([]);
  });

  test("matches the quote across spacing and punctuation differences", () => {
    // Given the model normalised the player's spacing while quoting
    const orderText = "부산항에, 조선소를 건설하라!";
    const intent: StrategicIntent = {
      type: "economy.invest",
      actorNationId: PLAYER,
      provinceId: OWNED,
      sector: "shipyard",
      budgetCredits: 80,
      sourceQuoteKo: "조선소를 건설하라",
    };

    // When
    const grounded = ground(orderText, [intent]);

    // Then
    expect(grounded.playerIntents).toHaveLength(1);
  });
});
