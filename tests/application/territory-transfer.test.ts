import { describe, expect, test } from "bun:test";

import { applyStrategicPlan } from "../../src/application/apply-strategic-plan";
import { createCampaignState } from "../../src/application/campaign-state";
import type { StrategicPlan } from "../../src/providers/schemas";

const planWithTransfer = (
  provinceId: string,
  fromNationId: string,
  toNationId: string,
): StrategicPlan => ({
  schemaVersion: 2,
  requestId: "req_territory_transfer_apply",
  playerIntents: [
    {
      type: "territory.transfer",
      actorNationId: toNationId,
      provinceId,
      fromNationId,
      toNationId,
      reasonKo: "강화 조약에 따른 할양",
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
  narrative: { ko: "조약이 체결되어 지배권이 이동했다." },
  warnings: [],
});

describe("territory transfer intent", () => {
  test("rejects v2 intents until their reducer is implemented", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");
    const plan: StrategicPlan = {
      schemaVersion: 2,
      requestId: "req_unsupported_war",
      playerIntents: [
        {
          type: "war.declare",
          actorNationId: "nat_kor",
          targetNationId: "nat_jpn",
          casusBelliKo: "국경 침범",
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
      narrative: { ko: "전쟁 계획이 제출됐다." },
      warnings: [],
    };

    // When
    const applyUnsupported = () => applyStrategicPlan({ snapshot, plan });

    // Then
    expect(applyUnsupported).toThrow("INTENT_NOT_SUPPORTED_YET");
  });

  test("moves province ownership and records why it moved", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");
    const target = snapshot.provinces.find(
      (province) => province.ownerNationId !== snapshot.playerNationId,
    );
    if (target === undefined) throw new Error("scenario has no non-player province");
    const plan = planWithTransfer(target.id, target.ownerNationId, snapshot.playerNationId);

    // When
    const after = applyStrategicPlan({ snapshot, plan, orderText: "즈리를 할양받는다" });
    const moved = after.provinces.find((province) => province.id === target.id);

    // Then
    expect(String(moved?.ownerNationId)).toBe(String(snapshot.playerNationId));
  });

  test("surfaces the transfer as a map-change record carrying reason and cause", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");
    const target = snapshot.provinces.find(
      (province) => province.ownerNationId !== snapshot.playerNationId,
    );
    if (target === undefined) throw new Error("scenario has no non-player province");
    const plan = planWithTransfer(target.id, target.ownerNationId, snapshot.playerNationId);

    // When
    const after = applyStrategicPlan({ snapshot, plan, orderText: "즈리를 할양받는다" });
    const resolution = after.resolutions[after.resolutions.length - 1];
    const change = resolution?.worldImpact.regionOwnershipOverrides.find(
      (record) => record.regionId === target.id,
    );

    // Then
    expect(change).toEqual({
      regionId: target.id,
      fromNationId: target.ownerNationId,
      toNationId: snapshot.playerNationId,
      reasonKo: "강화 조약에 따른 할양",
      cause: "player",
    });
  });

  test("attributes an NPC-driven transfer to the npc cause", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");
    const donor = snapshot.provinces.find(
      (province) => province.ownerNationId !== snapshot.playerNationId,
    );
    if (donor === undefined) throw new Error("scenario has no non-player province");
    const receiver = snapshot.nations.find(
      (nation) => nation.id !== donor.ownerNationId && nation.id !== snapshot.playerNationId,
    );
    if (receiver === undefined) throw new Error("scenario has no third nation");
    const plan: StrategicPlan = {
      schemaVersion: 2,
      requestId: "req_territory_transfer_npc",
      playerIntents: [],
      npcIntents: [
        {
          type: "territory.transfer",
          actorNationId: receiver.id,
          provinceId: donor.id,
          fromNationId: donor.ownerNationId,
          toNationId: receiver.id,
          reasonKo: "열강 간 비밀 협정",
        },
      ],
      narrative: { ko: "열강이 비밀리에 세력권을 교환했다." },
      warnings: [],
    };

    // When
    const after = applyStrategicPlan({ snapshot, plan, orderText: "정세를 관망한다" });
    const resolution = after.resolutions[after.resolutions.length - 1];
    const change = resolution?.worldImpact.regionOwnershipOverrides.find(
      (record) => record.regionId === donor.id,
    );

    // Then
    expect(change?.cause).toBe("npc");
    expect(change?.reasonKo).toBe("열강 간 비밀 협정");
  });

  test("rejects a transfer whose stated previous owner is not the real owner", () => {
    // Given
    const snapshot = createCampaignState("scn_ea1900", "nat_kor");
    const target = snapshot.provinces.find(
      (province) => province.ownerNationId !== snapshot.playerNationId,
    );
    if (target === undefined) throw new Error("scenario has no non-player province");
    const plan = planWithTransfer(target.id, snapshot.playerNationId, snapshot.playerNationId);

    // When
    const applyMismatched = () =>
      applyStrategicPlan({ snapshot, plan, orderText: "즈리를 할양받는다" });

    // Then
    expect(applyMismatched).toThrow("INTENT_TERRITORY_INVALID");
  });
});
