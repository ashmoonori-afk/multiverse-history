import { describe, expect, test } from "bun:test";

import {
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

describe("campaign state compatibility", () => {
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
    const reactionIds = ["rct_evt_1_1_nat_kor", "rct_evt_1_1_nat_jpn"];
    const enriched = {
      ...legacy,
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
      resolutions: legacy.resolutions.map((resolution) => ({
        ...resolution,
        worldEventIds: ["evt_1_1"],
        reactionIds,
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
