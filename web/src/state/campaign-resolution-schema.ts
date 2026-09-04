import { z } from "zod";

import {
  NationIdSchema,
  ProvinceIdSchema,
  TreatyIdSchema,
  UnitIdSchema,
} from "./campaign-id-schemas";

const NumericDeltaSchema = z
  .object({
    before: z.number().int(),
    after: z.number().int(),
    source: z.enum(["policy", "tick"]).default("policy"),
  })
  .strict();

const CampaignNewsArticleSchema = z
  .object({
    headlineKo: z.string().min(1),
    ledeKo: z.string().min(1),
    paragraphsKo: z.array(z.string().min(1)).min(2),
    quote: z
      .object({
        textKo: z.string().min(1),
        attributionKo: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();

export const CampaignResolutionSchema = z
  .object({
    id: z.string(),
    turn: z.number().int().nonnegative(),
    timestampKo: z.string().min(1),
    cadence: z.enum(["week", "month", "quarter", "year", "major"]),
    advanceDays: z.number().int().positive(),
    orderText: z.string().min(1),
    narrativeKo: z.string().min(1),
    articleKo: z.string().min(1),
    article: CampaignNewsArticleSchema,
    nationDeltas: z.array(
      z
        .object({
          nationId: NationIdSchema,
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
          fromNationId: NationIdSchema,
          toNationId: NationIdSchema,
          before: z.number().int(),
          after: z.number().int(),
          source: z.enum(["policy", "tick"]).default("policy"),
        })
        .strict(),
    ),
    treatyDeltas: z.array(
      z
        .object({
          id: TreatyIdSchema,
          proposerNationId: NationIdSchema,
          recipientNationId: NationIdSchema,
          clauses: z.array(z.string()),
          status: z.enum(["proposed", "active", "rejected", "terminated"]),
          proposedTurn: z.number().int().nonnegative(),
          resolvedTurn: z.number().int().nonnegative().optional(),
          terminatedTurn: z.number().int().nonnegative().optional(),
          source: z.enum(["policy", "tick"]).default("policy"),
        })
        .strict(),
    ),
    unitDeltas: z
      .array(
        z
          .object({
            unitId: UnitIdSchema,
            ownerNationId: NationIdSchema,
            before: z
              .object({
                ownerNationId: NationIdSchema,
                provinceId: ProvinceIdSchema,
                manpower: z.number().int().nonnegative(),
              })
              .strict()
              .nullable(),
            after: z
              .object({
                ownerNationId: NationIdSchema,
                provinceId: ProvinceIdSchema,
                manpower: z.number().int().nonnegative(),
              })
              .strict()
              .nullable(),
            source: z.enum(["policy", "tick"]).default("policy"),
          })
          .strict(),
      )
      .default([]),
    worldEventIds: z.array(z.string()).default([]),
    reactionIds: z.array(z.string()).default([]),
    worldImpact: z
      .object({
        changedNationIds: z.array(z.string()),
        changedProvinceIds: z.array(z.string()),
        summaryKo: z.string().min(1),
        regionOwnershipOverrides: z
          .array(
            z
              .object({
                regionId: z.string(),
                toNationId: z.string(),
                fromNationId: z.string(),
                reasonKo: z.string().min(1),
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

export type CampaignResolution = z.infer<typeof CampaignResolutionSchema>;
