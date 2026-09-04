import { expect, test } from "bun:test";

import { createCampaignResolution } from "../../src/application/campaign-resolution";
import { createCampaignState } from "../../src/application/campaign-state";

test("summarizes only nations that participated in actual changes", () => {
  // Given
  const before = createCampaignState("scn_ea1900", "nat_kor");
  const after = {
    ...before,
    constructionProjects: [
      ...before.constructionProjects,
      {
        id: "cst_1_0",
        ownerNationId: "nat_jpn",
        provinceId: "prv_jpn_kanto",
        kind: "rail",
        investedCredits: 50,
        startedTurn: 1,
        status: "active" as const,
      },
    ],
  };

  // When
  const resolution = createCampaignResolution({
    before,
    after,
    turn: 1,
    cadence: "quarter",
    advanceDays: 91,
    orderText: "시간을 진행한다.",
    narrativeKo: "일본제국이 간토에 철도를 건설했다.",
    changedProvinceIds: ["prv_jpn_kanto"],
  });

  // Then
  expect({
    participantNationIds: resolution.worldImpact.changedNationIds,
    summaryKo: resolution.worldImpact.summaryKo,
  }).toEqual({
    participantNationIds: ["nat_jpn"],
    summaryKo: "일본제국의 간토 지역에 변화가 확정됐다.",
  });
});
