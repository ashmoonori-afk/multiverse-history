import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { createCampaignResolution } from "../../src/application/campaign-resolution";
import { createCampaignState } from "../../src/application/campaign-state";
import { ResolutionArticle } from "../../web/src/features/resolution/ResolutionArticle";
import { ResolutionDeltaGroups } from "../../web/src/features/resolution/ResolutionDeltaGroups";
import { ResolutionFeed } from "../../web/src/features/resolution/ResolutionFeed";
import type { Campaign } from "../../web/src/state/campaign-store";

test("renders policy and time-tick deltas under separate headings", () => {
  // Given
  const base = createCampaignState("scn_ea1900", "nat_kor");
  const policyState = {
    ...base,
    nations: base.nations.map((nation) =>
      nation.id === "nat_kor"
        ? { ...nation, treasuryCredits: nation.treasuryCredits - 25 }
        : nation,
    ),
  };
  const policyResolution = createCampaignResolution({
    before: base,
    after: policyState,
    turn: 1,
    cadence: "year",
    advanceDays: 365,
    orderText: "제주에 공항을 건설한다",
    narrativeKo: "공항 건설과 함께 한 해가 흘렀다.",
    changedProvinceIds: [],
  });
  const tickDelta = {
    nationId: "nat_kor",
    nationNameKo: "대한제국",
    treasuryCredits: { before: 175, after: 190, source: "tick" as const },
    gdpCredits: { before: 1_000, after: 1_010, source: "tick" as const },
    infrastructureBps: { before: 2_025, after: 2_025, source: "tick" as const },
    population: { before: 17_000_000, after: 17_136_000, source: "tick" as const },
  };
  const campaign = {
    ...base,
    resolutions: [
      { ...policyResolution, nationDeltas: [...policyResolution.nationDeltas, tickDelta] },
    ],
  } as Campaign;

  // When
  const html = renderToStaticMarkup(
    <ResolutionFeed campaign={campaign} nationNameById={new Map([["nat_kor", "대한제국"]])} />,
  );

  // Then
  expect(html).toContain('data-testid="resolution-policy-deltas"');
  expect(html).toContain('data-testid="resolution-tick-deltas"');
  expect(html).toContain("정책 결과");
  expect(html).toContain("시간 경과");
  expect(html).not.toContain("0 → 0");
});

test("puts the headline and delta groups before at most five affected-nation chips", () => {
  // Given
  const base = createCampaignState("scn_ea1900", "nat_kor");
  const resolution = createCampaignResolution({
    before: base,
    after: base,
    turn: 1,
    cadence: "year",
    advanceDays: 365,
    orderText: "제주에 공항을 건설한다",
    narrativeKo: "공항 건설과 함께 한 해가 흘렀다.",
    changedProvinceIds: [],
  });
  const clientResolution = {
    ...resolution,
    worldImpact: {
      ...resolution.worldImpact,
      changedNationIds: [
        "nat_kor",
        "nat_jpn",
        "nat_qing",
        "nat_rus",
        "nat_usa",
        "nat_fra",
        "nat_gbr",
      ],
    },
  } as Campaign["resolutions"][number];
  const nationNameById = new Map([
    ["nat_kor", "대한제국"],
    ["nat_jpn", "일본제국"],
    ["nat_qing", "청나라"],
    ["nat_rus", "러시아제국"],
    ["nat_usa", "미합중국"],
    ["nat_fra", "여섯 번째 국가"],
    ["nat_gbr", "일곱 번째 국가"],
  ]);

  // When
  const html = renderToStaticMarkup(
    <ResolutionArticle
      resolution={clientResolution}
      playerNationId="nat_kor"
      nationNameById={nationNameById}
    />,
  );

  // Then
  const headlineIndex = html.indexOf('data-testid="resolution-article-headline"');
  const deltaIndex = html.indexOf('data-testid="resolution-before-after"');
  const actorsIndex = html.indexOf('data-testid="resolution-article-actors"');
  expect(headlineIndex).toBeGreaterThan(-1);
  expect(deltaIndex).toBeGreaterThan(headlineIndex);
  expect(actorsIndex).toBeGreaterThan(deltaIndex);
  expect(html).toContain("+2개국");
  expect(html).not.toContain(">여섯 번째 국가</li>");
  expect(html).not.toContain(">일곱 번째 국가</li>");
});

test("uses the opposite nation for relation and treaty rows when the player is recipient", () => {
  // Given
  const base = createCampaignState("scn_ea1900", "nat_kor");
  const resolution = {
    ...createCampaignResolution({
      before: base,
      after: base,
      turn: 1,
      cadence: "quarter",
      advanceDays: 90,
      orderText: "통상 협정을 검토한다",
      narrativeKo: "협정 검토가 진행됐다.",
      changedProvinceIds: [],
    }),
    relationDeltas: [
      {
        fromNationId: "nat_jpn",
        toNationId: "nat_kor",
        before: 0,
        after: 100,
        source: "policy" as const,
      },
    ],
    treatyDeltas: [
      {
        id: "try_counterpart",
        proposerNationId: "nat_jpn",
        recipientNationId: "nat_kor",
        clauses: ["trade"],
        status: "proposed" as const,
        proposedTurn: 1,
        source: "policy" as const,
      },
    ],
  } as Campaign["resolutions"][number];

  // When
  const html = renderToStaticMarkup(
    <ResolutionDeltaGroups
      resolution={resolution}
      playerNationId="nat_kor"
      nationNameById={
        new Map([
          ["nat_kor", "대한제국"],
          ["nat_jpn", "일본제국"],
        ])
      }
    />,
  );

  // Then
  expect(html).toContain("외교 관계 · 일본제국");
  expect(html).toContain("일본제국 · proposed");
  expect(html).not.toContain("대한제국 · proposed");
});
