import { z } from "zod";

import { provinceNameKo } from "../shared/display-labels";
import {
  type CampaignNewsArticle,
  CampaignNewsArticleSchema,
  campaignNewsArticleBody,
  createCampaignNewsArticle,
} from "./campaign-news-article";
import type { CampaignState, TimelineCadence } from "./campaign-state";

export interface CampaignNumericDelta {
  readonly before: number;
  readonly after: number;
}

export interface CampaignNationDelta {
  readonly nationId: string;
  readonly nationNameKo: string;
  readonly treasuryCredits: CampaignNumericDelta;
  readonly gdpCredits: CampaignNumericDelta;
  readonly infrastructureBps: CampaignNumericDelta;
}

export interface CampaignRelationDelta {
  readonly fromNationId: string;
  readonly toNationId: string;
  readonly before: number;
  readonly after: number;
}

export interface CampaignTreatyDelta {
  readonly id: string;
  readonly proposerNationId: string;
  readonly recipientNationId: string;
  readonly clauses: readonly string[];
  readonly status: "proposed" | "active";
  readonly proposedTurn: number;
}

export interface CampaignWorldImpact {
  readonly changedNationIds: readonly string[];
  readonly changedProvinceIds: readonly string[];
  readonly summaryKo: string;
}

export interface CampaignResolution {
  readonly id: string;
  readonly turn: number;
  readonly timestampKo: string;
  readonly cadence: TimelineCadence;
  readonly advanceDays: number;
  readonly orderText: string;
  readonly narrativeKo: string;
  readonly articleKo: string;
  readonly article: CampaignNewsArticle;
  readonly nationDeltas: readonly CampaignNationDelta[];
  readonly relationDeltas: readonly CampaignRelationDelta[];
  readonly treatyDeltas: readonly CampaignTreatyDelta[];
  readonly worldImpact: CampaignWorldImpact;
}

const NumericDeltaSchema = z
  .object({
    before: z.number().safe().int(),
    after: z.number().safe().int(),
  })
  .strict();

export const CampaignResolutionSchema = z
  .object({
    id: z.string().regex(/^res_[a-z0-9_]+$/),
    turn: z.number().safe().int().nonnegative(),
    timestampKo: z.string().min(1),
    cadence: z.enum(["week", "month", "quarter", "year", "major"]).default("quarter"),
    advanceDays: z.number().safe().int().positive().default(91),
    orderText: z.string().min(1),
    narrativeKo: z.string().min(1),
    articleKo: z.string().min(1).default("이전 기록은 뉴스 단신 형식으로 작성되지 않았습니다."),
    article: CampaignNewsArticleSchema.default({
      headlineKo: "이전 기록",
      ledeKo: "이전 기록은 구조화 뉴스 형식으로 작성되지 않았습니다.",
      paragraphsKo: [
        "이 기록의 원문은 캠페인 감사 데이터에 보존되어 있습니다.",
        "새 턴부터 구조화된 기사 형식이 적용됩니다.",
      ],
    }),
    nationDeltas: z.array(
      z
        .object({
          nationId: z.string().regex(/^nat_[a-z0-9_]+$/),
          nationNameKo: z.string().min(1),
          treasuryCredits: NumericDeltaSchema,
          gdpCredits: NumericDeltaSchema,
          infrastructureBps: NumericDeltaSchema,
        })
        .strict(),
    ),
    relationDeltas: z.array(
      z
        .object({
          fromNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
          toNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
          before: z.number().safe().int(),
          after: z.number().safe().int(),
        })
        .strict(),
    ),
    treatyDeltas: z.array(
      z
        .object({
          id: z.string().min(1),
          proposerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
          recipientNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
          clauses: z.array(z.string().min(1)),
          status: z.enum(["proposed", "active"]),
          proposedTurn: z.number().safe().int().nonnegative(),
        })
        .strict(),
    ),
    worldImpact: z
      .object({
        changedNationIds: z.array(z.string().regex(/^nat_[a-z0-9_]+$/)),
        changedProvinceIds: z.array(z.string().min(1)),
        summaryKo: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const numericDelta = (before: number, after: number): CampaignNumericDelta =>
  Object.freeze({ before, after });

const unique = (values: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(values)]);

const nationName = (state: CampaignState, nationId: string): string =>
  state.nations.find((nation) => nation.id === nationId)?.nameKo ?? nationId;

export type CampaignResolutionDraft = Omit<CampaignResolution, "articleKo" | "article">;

export interface CreateCampaignResolutionInput {
  readonly before: CampaignState;
  readonly after: CampaignState;
  readonly turn: number;
  readonly cadence: TimelineCadence;
  readonly advanceDays: number;
  readonly orderText: string;
  readonly narrativeKo: string;
  readonly changedProvinceIds: readonly string[];
}

export const createCampaignResolution = (
  input: CreateCampaignResolutionInput,
): CampaignResolution => {
  const nationDeltas = input.after.nations.flatMap((afterNation) => {
    const beforeNation = input.before.nations.find((nation) => nation.id === afterNation.id);
    if (
      beforeNation === undefined ||
      (beforeNation.treasuryCredits === afterNation.treasuryCredits &&
        beforeNation.gdpCredits === afterNation.gdpCredits &&
        beforeNation.infrastructureBps === afterNation.infrastructureBps)
    ) {
      return [];
    }
    return [
      Object.freeze({
        nationId: afterNation.id,
        nationNameKo: afterNation.nameKo,
        treasuryCredits: numericDelta(beforeNation.treasuryCredits, afterNation.treasuryCredits),
        gdpCredits: numericDelta(beforeNation.gdpCredits, afterNation.gdpCredits),
        infrastructureBps: numericDelta(
          beforeNation.infrastructureBps,
          afterNation.infrastructureBps,
        ),
      }),
    ];
  });
  const relationDeltas = input.after.relations.flatMap((afterRelation) => {
    const beforeRelation = input.before.relations.find(
      (relation) =>
        relation.fromNationId === afterRelation.fromNationId &&
        relation.toNationId === afterRelation.toNationId,
    );
    const beforeValue = beforeRelation?.value ?? 0;
    return beforeValue === afterRelation.value
      ? []
      : [
          Object.freeze({
            fromNationId: afterRelation.fromNationId,
            toNationId: afterRelation.toNationId,
            before: beforeValue,
            after: afterRelation.value,
          }),
        ];
  });
  const treatyDeltas = input.after.treaties.flatMap((treaty) =>
    input.before.treaties.some((candidate) => candidate.id === treaty.id)
      ? []
      : [Object.freeze({ ...treaty, clauses: Object.freeze([...treaty.clauses]) })],
  );
  const changedNationIds = unique([
    ...nationDeltas.map((delta) => delta.nationId),
    ...relationDeltas.flatMap((delta) => [delta.fromNationId, delta.toNationId]),
    ...treatyDeltas.flatMap((delta) => [delta.proposerNationId, delta.recipientNationId]),
  ]);
  const changedProvinceIds = unique([
    ...input.changedProvinceIds,
    ...input.after.provinces.flatMap((afterProvince) => {
      const beforeProvince = input.before.provinces.find(
        (province) => province.id === afterProvince.id,
      );
      return beforeProvince?.ownerNationId === afterProvince.ownerNationId
        ? []
        : [afterProvince.id];
    }),
  ]);
  const changedNationNames = changedNationIds.map((nationId) => nationName(input.after, nationId));
  const changedProvinceNames = changedProvinceIds.map(provinceNameKo);
  const summaryKo =
    changedNationNames.length === 0
      ? "이번 턴에는 지도상 소유권 변화가 없었다."
      : `${changedNationNames.join("·")}의 ${changedProvinceNames.join(", ")} 지역에 변화가 확정됐다.`;
  const draft: CampaignResolutionDraft = Object.freeze({
    id: `res_${input.turn}_${input.after.resolutions.length + 1}`,
    turn: input.turn,
    timestampKo: `${input.after.date.year}년 ${input.after.date.quarter}분기 · +${input.advanceDays}일 · 턴 ${input.turn}`,
    cadence: input.cadence,
    advanceDays: input.advanceDays,
    orderText: input.orderText,
    narrativeKo: input.narrativeKo,
    nationDeltas: Object.freeze(nationDeltas),
    relationDeltas: Object.freeze(relationDeltas),
    treatyDeltas: Object.freeze(treatyDeltas),
    worldImpact: Object.freeze({
      changedNationIds,
      changedProvinceIds,
      summaryKo,
    }),
  });
  const article = createCampaignNewsArticle(
    draft,
    new Map(input.after.nations.map((nation) => [nation.id, nation.nameKo])),
  );
  return Object.freeze({ ...draft, article, articleKo: campaignNewsArticleBody(article) });
};
