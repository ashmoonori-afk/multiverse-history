import { z } from "zod";

import type { CampaignState } from "./campaign-state";

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
  readonly orderText: string;
  readonly narrativeKo: string;
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
    orderText: z.string().min(1),
    narrativeKo: z.string().min(1),
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

export interface CreateCampaignResolutionInput {
  readonly before: CampaignState;
  readonly after: CampaignState;
  readonly turn: number;
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
  const summaryKo =
    changedNationNames.length === 0
      ? "이번 턴에는 지도상 소유권 변화가 없었습니다."
      : `${changedNationNames.join("·")}의 ${changedProvinceIds.join(", ")} 지역에 변화가 확정되었습니다.`;
  return Object.freeze({
    id: `res_${input.turn}_${input.after.resolutions.length + 1}`,
    turn: input.turn,
    timestampKo: `${input.after.date.year}년 ${input.after.date.quarter}분기 · 턴 ${input.turn}`,
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
};
