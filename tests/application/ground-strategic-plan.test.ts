import { describe, expect, test } from "bun:test";

import { applyStrategicPlan } from "../../src/application/apply-strategic-plan";
import { createCampaignState } from "../../src/application/campaign-state";
import { groundStrategicPlan } from "../../src/application/ground-strategic-plan";
import type { StrategicIntent, StrategicPlan } from "../../src/providers/schemas";

const PLAYER = "nat_kor";
const OWNED = "prv_kor_hanseong";
const FOREIGN = "prv_jpn_kanto";

const planWith = (playerIntents: readonly StrategicIntent[]): StrategicPlan => ({
  schemaVersion: 2,
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

  test("keeps all quoted v2 intents under the player's authority", () => {
    // Given
    const sourceQuoteKo = "명령을 실행하라";
    const intents = [
      {
        type: "nation.adjust",
        nationId: PLAYER,
        treasuryDelta: 10,
        reasonKo: "재정 조정",
        sourceQuoteKo,
      },
      {
        type: "relation.adjust",
        fromNationId: PLAYER,
        toNationId: "nat_jpn",
        delta: -100,
        reasonKo: "외교 마찰",
        sourceQuoteKo,
      },
      {
        type: "treaty.respond",
        treatyId: "try_1_0",
        decision: "accept",
        actorNationId: PLAYER,
        sourceQuoteKo,
      },
      {
        type: "treaty.terminate",
        treatyId: "try_1_0",
        actorNationId: PLAYER,
        reasonKo: "의무 불이행",
        sourceQuoteKo,
      },
      {
        type: "war.declare",
        actorNationId: PLAYER,
        targetNationId: "nat_jpn",
        casusBelliKo: "국경 침범",
        sourceQuoteKo,
      },
      { type: "war.peace", warId: "war_1_0", terms: [], sourceQuoteKo },
      { type: "unit.move", unitId: "unt_1_0", toProvinceId: OWNED, sourceQuoteKo },
      { type: "unit.attack", unitId: "unt_1_0", targetProvinceId: FOREIGN, sourceQuoteKo },
      { type: "unit.disband", unitId: "unt_1_0", sourceQuoteKo },
      { type: "polity.change", nationId: PLAYER, governmentKo: "입헌군주제", sourceQuoteKo },
      {
        type: "action.fail",
        actorNationId: PLAYER,
        attemptKo: "해군 증강",
        stabilityDelta: -100,
        sourceQuoteKo,
      },
    ] satisfies readonly StrategicIntent[];

    // When
    const grounded = ground(sourceQuoteKo, intents);

    // Then
    expect(grounded.playerIntents).toEqual(intents);
    expect(grounded.warnings).not.toContain("PLAYER_INTENT_UNGROUNDED");
  });

  test("does not treat a target, counterpart, or recipient as the player actor", () => {
    // Given
    const sourceQuoteKo = "명령을 실행하라";
    const impostors = [
      {
        type: "relation.adjust",
        fromNationId: "nat_jpn",
        toNationId: PLAYER,
        delta: 100,
        reasonKo: "외교 선전",
        sourceQuoteKo,
      },
      {
        type: "war.declare",
        actorNationId: "nat_jpn",
        targetNationId: PLAYER,
        casusBelliKo: "국경 분쟁",
        sourceQuoteKo,
      },
      {
        type: "diplomacy.propose_treaty",
        actorNationId: "nat_jpn",
        recipientNationId: PLAYER,
        clauses: ["trade"],
        sourceQuoteKo,
      },
      {
        type: "territory.transfer",
        actorNationId: "nat_jpn",
        provinceId: FOREIGN,
        fromNationId: "nat_jpn",
        toNationId: PLAYER,
        reasonKo: "영토 양도",
        sourceQuoteKo,
      },
    ] satisfies readonly StrategicIntent[];

    // When
    const grounded = ground(sourceQuoteKo, impostors);

    // Then
    expect(grounded.playerIntents).toEqual([]);
    expect(grounded.warnings).toContain("PLAYER_INTENT_UNGROUNDED");
  });

  test("lets a quoted v2 player intent reach its reducer", () => {
    // Given
    const orderText = "일본에 선전포고하라";
    const snapshot = createCampaignState("scn_ea1900", PLAYER);
    const grounded = ground(orderText, [
      {
        type: "war.declare",
        actorNationId: PLAYER,
        targetNationId: "nat_jpn",
        casusBelliKo: "국경 침범",
        sourceQuoteKo: orderText,
      },
    ]);

    // When
    const reduced = applyStrategicPlan({ snapshot, plan: grounded, orderText });

    // Then
    expect(reduced.wars[0]?.status).toBe("active");
  });
});
