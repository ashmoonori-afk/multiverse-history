import { describe, expect, test } from "bun:test";

import { CampaignResolutionSchema } from "../../web/src/state/campaign-resolution-schema";

const resolutionWith = (regionOwnershipOverrides: readonly unknown[]): unknown => ({
  id: "res_1_1",
  turn: 1,
  timestampKo: "1900년 1분기 · +90일 · 턴 1",
  cadence: "quarter",
  advanceDays: 90,
  orderText: "즈리를 할양받는다",
  narrativeKo: "조약이 체결되어 지배권이 이동했다.",
  articleKo: "즈리 할양 확정",
  article: {
    headlineKo: "즈리 할양 확정",
    ledeKo: "대한제국이 즈리를 넘겨받았다.",
    paragraphsKo: ["조약이 조인됐다.", "역내 반응이 엇갈린다."],
  },
  nationDeltas: [],
  relationDeltas: [],
  treatyDeltas: [],
  worldEventIds: [],
  reactionIds: [],
  worldImpact: {
    changedNationIds: ["nat_kor"],
    changedProvinceIds: ["prv_qing_zhili"],
    summaryKo: "즈리의 지배권이 바뀌었다.",
    regionOwnershipOverrides,
  },
});

describe("client map-change records", () => {
  test("accepts an ownership change carrying its reason and cause", () => {
    // Given
    const payload = resolutionWith([
      {
        regionId: "prv_qing_zhili",
        fromNationId: "nat_qing",
        toNationId: "nat_kor",
        reasonKo: "강화 조약에 따른 할양",
        cause: "player",
      },
    ]);

    // When
    const parsed = CampaignResolutionSchema.parse(payload);
    const change = parsed.worldImpact.regionOwnershipOverrides[0];

    // Then
    expect(change?.reasonKo).toBe("강화 조약에 따른 할양");
    expect(change?.cause).toBe("player");
  });

  test("rejects an ownership change that omits why the map moved", () => {
    // Given
    const payload = resolutionWith([
      { regionId: "prv_qing_zhili", fromNationId: "nat_qing", toNationId: "nat_kor" },
    ]);

    // When
    const parseIncomplete = () => CampaignResolutionSchema.parse(payload);

    // Then
    expect(parseIncomplete).toThrow();
  });

  test("rejects an unknown cause", () => {
    // Given
    const payload = resolutionWith([
      {
        regionId: "prv_qing_zhili",
        fromNationId: "nat_qing",
        toNationId: "nat_kor",
        reasonKo: "출처 불명",
        cause: "meteor",
      },
    ]);

    // When
    const parseUnknownCause = () => CampaignResolutionSchema.parse(payload);

    // Then
    expect(parseUnknownCause).toThrow();
  });
});
