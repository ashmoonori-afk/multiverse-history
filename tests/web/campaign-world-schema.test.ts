import { describe, expect, test } from "bun:test";

import { CampaignWorldEventSchema } from "../../web/src/state/campaign-world-schema";

const event = {
  id: "evt_contract",
  kind: "military",
  importance: "major",
  occurredAtElapsedDays: 30,
  turn: 1,
  date: { year: 1900, quarter: 1 },
  actorNationIds: ["nat_kor"],
  affectedNationIds: ["nat_kor"],
  headlineKo: "병력 이동",
  summaryKo: "병력이 이동했다.",
  impacts: {
    unitOps: [{ op: "move", unitId: "unt_kor_1", provinceId: "prv_kor_jeolla" }],
  },
  provenance: "player_divergence",
  regionIds: ["prv_kor_jeolla"],
  sourceInputIds: ["req_contract"],
} as const;

describe("client world event contract", () => {
  test("mirrors strict unit operations, removed markers, and required D7 metadata", () => {
    // Given / When / Then
    expect(CampaignWorldEventSchema.safeParse(event).success).toBe(true);
    expect(
      CampaignWorldEventSchema.safeParse({
        ...event,
        impacts: { unitOps: [{ op: "move", unitId: "unt_kor_1" }] },
      }).success,
    ).toBe(false);
    expect(
      CampaignWorldEventSchema.safeParse({ ...event, impacts: { markerOps: [] } }).success,
    ).toBe(false);
    const { provenance: _provenance, ...missingProvenance } = event;
    expect(CampaignWorldEventSchema.safeParse(missingProvenance).success).toBe(false);
  });
});
