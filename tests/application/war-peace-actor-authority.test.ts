import { describe, expect, test } from "bun:test";

import { applyStrategicPlan } from "../../src/application/apply-strategic-plan";
import { createCampaignState, parseCampaignState } from "../../src/application/campaign-state";
import { canonicalStringify } from "../../src/shared/canonical-json";

const snapshotWithWar = () =>
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

describe("war.peace nested actor authority", () => {
  test("atomically rejects a transfer actor that differs from the peace actor", () => {
    const snapshot = snapshotWithWar();
    const before = canonicalStringify(snapshot);

    const applySpoofedPeace = () =>
      applyStrategicPlan({
        snapshot,
        orderText: "청과 강화한다",
        plan: {
          schemaVersion: 2,
          requestId: "req_nested_peace_actor_reducer",
          playerIntents: [
            {
              type: "war.peace",
              actorNationId: "nat_kor",
              warId: "war_0_0",
              terms: [
                {
                  type: "territory.transfer",
                  actorNationId: "nat_qing",
                  provinceId: "prv_qing_manchuria",
                  fromNationId: "nat_qing",
                  toNationId: "nat_kor",
                  reasonKo: "강화 조약",
                },
              ],
            },
          ],
          npcIntents: [],
          narrative: { ko: "위조된 강화 조건이다." },
          warnings: [],
        },
      });

    expect(applySpoofedPeace).toThrow("INTENT_ACTOR_INVALID");
    expect(canonicalStringify(snapshot)).toBe(before);
  });

  test("preserves a legitimate transfer authorized by the peace actor", () => {
    const snapshot = snapshotWithWar();

    const result = applyStrategicPlan({
      snapshot,
      orderText: "청과 강화한다",
      plan: {
        schemaVersion: 2,
        requestId: "req_legitimate_peace_actor_reducer",
        playerIntents: [
          {
            type: "war.peace",
            actorNationId: "nat_kor",
            warId: "war_0_0",
            terms: [
              {
                type: "territory.transfer",
                actorNationId: "nat_kor",
                provinceId: "prv_qing_manchuria",
                fromNationId: "nat_qing",
                toNationId: "nat_kor",
                reasonKo: "강화 조약",
              },
            ],
          },
        ],
        npcIntents: [],
        narrative: { ko: "합법적인 강화 조건이다." },
        warnings: [],
      },
    });

    expect(result.wars[0]?.status).toBe("ended");
    expect(
      String(
        result.provinces.find((province) => province.id === "prv_qing_manchuria")?.ownerNationId,
      ),
    ).toBe("nat_kor");
  });
});
