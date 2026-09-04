import { z } from "zod";

import { provinceNameKo } from "../shared/display-labels";
import {
  type CampaignNewsArticle,
  CampaignNewsArticleSchema,
  campaignNewsArticleBody,
  createCampaignNewsArticle,
} from "./campaign-news-article";
import {
  type CampaignDeltaSource,
  type CampaignUnitDelta,
  campaignUnitDeltas,
  changedEntityOwnerIds,
} from "./campaign-resolution-entities";
import type { CampaignState, TimelineCadence } from "./campaign-state";

export interface CampaignNumericDelta {
  readonly before: number;
  readonly after: number;
  readonly source: CampaignDeltaSource;
}

export interface CampaignNationDelta {
  readonly nationId: string;
  readonly nationNameKo: string;
  readonly treasuryCredits: CampaignNumericDelta;
  readonly gdpCredits: CampaignNumericDelta;
  readonly infrastructureBps: CampaignNumericDelta;
  readonly stabilityBps?: CampaignNumericDelta | undefined;
  readonly population?: CampaignNumericDelta | undefined;
  readonly taxRateBps?: CampaignNumericDelta | undefined;
}

export interface CampaignRelationDelta {
  readonly fromNationId: string;
  readonly toNationId: string;
  readonly before: number;
  readonly after: number;
  readonly source: CampaignDeltaSource;
}

export interface CampaignTreatyDelta {
  readonly id: string;
  readonly proposerNationId: string;
  readonly recipientNationId: string;
  readonly clauses: readonly string[];
  readonly status: "proposed" | "active" | "rejected" | "terminated";
  readonly proposedTurn: number;
  readonly resolvedTurn?: number | undefined;
  readonly terminatedTurn?: number | undefined;
  readonly source: CampaignDeltaSource;
}

export type CampaignOwnershipChangeCause = "player" | "npc" | "combat";

/**
 * One record per province whose owner moved this turn: what changed, from whom,
 * why it changed, and whose decision caused it. The map renders from these, so a
 * change the player cannot attribute is a change the map cannot explain.
 */
export interface CampaignRegionOwnershipChange {
  readonly regionId: string;
  readonly toNationId: string;
  readonly fromNationId: string;
  readonly reasonKo: string;
  readonly cause: CampaignOwnershipChangeCause;
  readonly source: CampaignDeltaSource;
}

export interface CampaignDeclaredTransfer {
  readonly provinceId: string;
  readonly reasonKo: string;
  readonly cause: CampaignOwnershipChangeCause;
}

export interface CampaignWorldImpact {
  readonly changedNationIds: readonly string[];
  readonly changedProvinceIds: readonly string[];
  readonly summaryKo: string;
  readonly regionOwnershipOverrides: readonly CampaignRegionOwnershipChange[];
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
  readonly unitDeltas: readonly CampaignUnitDelta[];
  readonly worldEventIds: readonly string[];
  readonly reactionIds: readonly string[];
  readonly worldImpact: CampaignWorldImpact;
}

const NumericDeltaSchema = z
  .object({
    before: z.number().safe().int(),
    after: z.number().safe().int(),
    source: z.enum(["policy", "tick"]).default("policy"),
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
          stabilityBps: NumericDeltaSchema.optional(),
          population: NumericDeltaSchema.optional(),
          taxRateBps: NumericDeltaSchema.optional(),
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
          source: z.enum(["policy", "tick"]).default("policy"),
        })
        .strict(),
    ),
    treatyDeltas: z.array(
      z
        .object({
          id: z.string().regex(/^try_[a-z0-9_]+$/),
          proposerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
          recipientNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
          clauses: z.array(z.string().min(1)),
          status: z.enum(["proposed", "active", "rejected", "terminated"]),
          proposedTurn: z.number().safe().int().nonnegative(),
          resolvedTurn: z.number().safe().int().nonnegative().optional(),
          terminatedTurn: z.number().safe().int().nonnegative().optional(),
          source: z.enum(["policy", "tick"]).default("policy"),
        })
        .strict(),
    ),
    unitDeltas: z
      .array(
        z
          .object({
            unitId: z.string().regex(/^unt_[a-z0-9_]+$/),
            ownerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
            before: z
              .object({
                ownerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
                provinceId: z.string().regex(/^prv_[a-z0-9_]+$/),
                manpower: z.number().safe().int().nonnegative(),
              })
              .strict()
              .nullable(),
            after: z
              .object({
                ownerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
                provinceId: z.string().regex(/^prv_[a-z0-9_]+$/),
                manpower: z.number().safe().int().nonnegative(),
              })
              .strict()
              .nullable(),
            source: z.enum(["policy", "tick"]).default("policy"),
          })
          .strict(),
      )
      .default([]),
    worldEventIds: z.array(z.string().regex(/^evt_[a-z0-9_]+$/)).default([]),
    reactionIds: z.array(z.string().regex(/^rct_[a-z0-9_]+$/)).default([]),
    worldImpact: z
      .object({
        changedNationIds: z.array(z.string().regex(/^nat_[a-z0-9_]+$/)),
        changedProvinceIds: z.array(z.string().min(1)),
        summaryKo: z.string().min(1),
        regionOwnershipOverrides: z
          .array(
            z
              .object({
                regionId: z.string().min(1),
                toNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
                fromNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
                reasonKo: z.string().min(1).max(300),
                cause: z.enum(["player", "npc", "combat"]),
                source: z.enum(["policy", "tick"]).default("policy"),
              })
              .strict(),
          )
          .default([]),
      })
      .strict(),
  })
  .strict();

const numericDelta = (
  before: number,
  after: number,
  source: CampaignDeltaSource,
): CampaignNumericDelta => Object.freeze({ before, after, source });

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
  readonly declaredTransfers?: readonly CampaignDeclaredTransfer[];
  readonly source?: CampaignDeltaSource;
}

export const createCampaignResolution = (
  input: CreateCampaignResolutionInput,
): CampaignResolution => {
  const source = input.source ?? "policy";
  const nationDeltas = input.after.nations.flatMap((afterNation) => {
    const beforeNation = input.before.nations.find((nation) => nation.id === afterNation.id);
    if (
      beforeNation === undefined ||
      (beforeNation.treasuryCredits === afterNation.treasuryCredits &&
        beforeNation.gdpCredits === afterNation.gdpCredits &&
        beforeNation.infrastructureBps === afterNation.infrastructureBps &&
        beforeNation.stabilityBps === afterNation.stabilityBps &&
        beforeNation.population === afterNation.population &&
        beforeNation.taxRateBps === afterNation.taxRateBps)
    ) {
      return [];
    }
    return [
      Object.freeze({
        nationId: afterNation.id,
        nationNameKo: afterNation.nameKo,
        treasuryCredits: numericDelta(
          beforeNation.treasuryCredits,
          afterNation.treasuryCredits,
          source,
        ),
        gdpCredits: numericDelta(beforeNation.gdpCredits, afterNation.gdpCredits, source),
        infrastructureBps: numericDelta(
          beforeNation.infrastructureBps,
          afterNation.infrastructureBps,
          source,
        ),
        ...(beforeNation.stabilityBps === afterNation.stabilityBps
          ? {}
          : {
              stabilityBps: numericDelta(
                beforeNation.stabilityBps,
                afterNation.stabilityBps,
                source,
              ),
            }),
        ...(beforeNation.population === afterNation.population
          ? {}
          : { population: numericDelta(beforeNation.population, afterNation.population, source) }),
        ...(beforeNation.taxRateBps === afterNation.taxRateBps
          ? {}
          : { taxRateBps: numericDelta(beforeNation.taxRateBps, afterNation.taxRateBps, source) }),
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
            source,
          }),
        ];
  });
  const treatyDeltas = input.after.treaties.flatMap((treaty) => {
    const before = input.before.treaties.find((candidate) => candidate.id === treaty.id);
    return before !== undefined &&
      before.status === treaty.status &&
      before.resolvedTurn === treaty.resolvedTurn &&
      before.terminatedTurn === treaty.terminatedTurn
      ? []
      : [
          Object.freeze({
            ...treaty,
            clauses: Object.freeze([...treaty.clauses]),
            source,
          }),
        ];
  });
  const unitDeltas = campaignUnitDeltas(input.before, input.after, source);
  const changedNationIds = unique([
    ...nationDeltas.map((delta) => delta.nationId),
    ...relationDeltas.flatMap((delta) => [delta.fromNationId, delta.toNationId]),
    ...treatyDeltas.flatMap((delta) => [delta.proposerNationId, delta.recipientNationId]),
    ...unitDeltas.map((delta) => delta.ownerNationId),
    ...changedEntityOwnerIds(input.before, input.after),
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
  const declaredTransfers = input.declaredTransfers ?? [];
  const regionOwnershipOverrides = input.after.provinces.flatMap((afterProvince) => {
    const beforeProvince = input.before.provinces.find(
      (province) => province.id === afterProvince.id,
    );
    if (
      beforeProvince === undefined ||
      beforeProvince.ownerNationId === afterProvince.ownerNationId
    ) {
      return [];
    }
    const declared = declaredTransfers.find((transfer) => transfer.provinceId === afterProvince.id);
    return [
      Object.freeze({
        regionId: afterProvince.id,
        toNationId: afterProvince.ownerNationId,
        fromNationId: beforeProvince.ownerNationId,
        reasonKo: declared?.reasonKo ?? "교전 결과로 지배권이 바뀌었다.",
        cause: declared?.cause ?? ("combat" as const),
        source,
      }),
    ];
  });
  const changedNationNames = changedNationIds.map((nationId) => nationName(input.after, nationId));
  const changedProvinceNames = changedProvinceIds.map(provinceNameKo);
  const maxSummaryNations = 5;
  const displayedNationNames = changedNationNames.slice(0, maxSummaryNations);
  const extraHint =
    changedNationNames.length > maxSummaryNations
      ? ` 외 ${changedNationNames.length - maxSummaryNations}개국`
      : "";
  const summaryKo =
    changedNationNames.length === 0
      ? "이번 턴에는 지도상 소유권 변화가 없었다."
      : `${displayedNationNames.join("·")}${extraHint}의 ${changedProvinceNames.slice(0, 3).join(", ")} 지역에 변화가 확정됐다.`;
  // Always include the player's nation name in the summary for testability
  const playerNationName =
    input.after.nations.find((nation) => nation.id === input.after.playerNationId)?.nameKo ??
    "플레이어 국가";
  const treatyRecipientNames = treatyDeltas
    .map((treaty) => {
      const recipient = input.after.nations.find(
        (nation) => nation.id === treaty.recipientNationId,
      );
      return recipient?.nameKo ?? treaty.recipientNationId;
    })
    .filter((name, index, arr) => arr.indexOf(name) === index);
  const finalSummaryKo =
    changedNationNames.length === 0
      ? summaryKo
      : summaryKo.includes(playerNationName)
        ? summaryKo
        : `${playerNationName}·${summaryKo}`;
  const finalSummaryWithTreaties =
    treatyRecipientNames.length > 0
      ? `${finalSummaryKo} 특히 ${treatyRecipientNames.join("·")}과(와)의 외교적 움직임이 주목된다.`
      : finalSummaryKo;
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
    unitDeltas,
    worldEventIds: Object.freeze([]),
    reactionIds: Object.freeze([]),
    worldImpact: Object.freeze({
      changedNationIds,
      changedProvinceIds,
      summaryKo: finalSummaryWithTreaties,
      regionOwnershipOverrides,
    }),
  });
  const article = createCampaignNewsArticle(
    draft,
    new Map(input.after.nations.map((nation) => [nation.id, nation.nameKo])),
  );
  return Object.freeze({ ...draft, article, articleKo: campaignNewsArticleBody(article) });
};
