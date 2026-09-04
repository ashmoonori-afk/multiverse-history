import { z } from "zod";

import {
  EventIdSchema,
  NationIdSchema,
  ProvinceIdSchema,
  UnitIdSchema,
} from "./campaign-id-schemas";

export const CampaignConstructionProjectSchema = z
  .object({
    id: z.string(),
    ownerNationId: NationIdSchema,
    provinceId: ProvinceIdSchema,
    kind: z.string().regex(/^[a-z_]{2,24}$/),
    investedCredits: z.number().int().positive(),
    startedTurn: z.number().int().nonnegative(),
    status: z.literal("active"),
  })
  .strict();

const orderedUniqueNationIds = z
  .array(NationIdSchema)
  .refine((nationIds) => new Set(nationIds).size === nationIds.length);

const orderedUniqueRegionIds = z
  .array(ProvinceIdSchema)
  .refine((regionIds) => new Set(regionIds).size === regionIds.length);

const orderedUniqueSourceInputIds = z
  .array(z.string().regex(/^(?:chat|req)_[a-z0-9_]+$/))
  .refine((sourceInputIds) => new Set(sourceInputIds).size === sourceInputIds.length);

const UnitOpSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("spawn"),
      ownerNationId: NationIdSchema,
      provinceId: ProvinceIdSchema,
      manpower: z.number().safe().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      op: z.literal("move"),
      unitId: UnitIdSchema,
      provinceId: ProvinceIdSchema,
    })
    .strict(),
  z.object({ op: z.literal("remove"), unitId: UnitIdSchema }).strict(),
  z
    .object({
      op: z.literal("strength"),
      unitId: UnitIdSchema,
      manpower: z.number().safe().int().nonnegative(),
    })
    .strict(),
]);

const RegionOwnershipOverrideSchema = z
  .object({
    regionId: ProvinceIdSchema,
    toNationId: NationIdSchema,
    fromNationId: NationIdSchema.optional(),
    note: z.string().max(500).optional(),
    sourceEventId: EventIdSchema.optional(),
  })
  .strict();

const EventImpactSchema = z
  .object({
    regionTransfers: z.array(RegionOwnershipOverrideSchema).default([]),
    nationChanges: z
      .array(
        z
          .object({
            nationId: NationIdSchema,
            name: z.string().max(200).optional(),
            color: z.string().max(7).optional(),
            stabilityChange: z.number().int().min(-10_000).max(10_000).optional(),
            treasuryChange: z.number().int().optional(),
          })
          .strict(),
      )
      .default([]),
    relationChanges: z
      .array(
        z
          .object({
            fromNationId: NationIdSchema,
            toNationId: NationIdSchema,
            delta: z.number().int().min(-10_000).max(10_000),
          })
          .strict(),
      )
      .default([]),
    unitOps: z.array(UnitOpSchema).default([]),
  })
  .strict();

export const CampaignWorldEventSchema = z
  .object({
    id: EventIdSchema,
    kind: z.enum(["economic", "diplomatic", "military", "political"]),
    importance: z.enum(["minor", "major"]),
    occurredAtElapsedDays: z.number().safe().int().nonnegative(),
    turn: z.number().safe().int().nonnegative(),
    date: z
      .object({
        year: z.number().safe().int(),
        quarter: z.number().safe().int().min(1).max(4),
      })
      .strict(),
    actorNationIds: orderedUniqueNationIds,
    affectedNationIds: orderedUniqueNationIds,
    headlineKo: z.string().min(1).max(160),
    summaryKo: z.string().min(1).max(1_200),
    sourceResolutionId: z
      .string()
      .regex(/^res_[a-z0-9_]+$/)
      .optional(),
    impacts: EventImpactSchema,
    provenance: z.enum([
      "historical_baseline",
      "player_divergence",
      "simulated_consequence",
      "unknown",
    ]),
    regionIds: orderedUniqueRegionIds,
    sourceInputIds: orderedUniqueSourceInputIds,
  })
  .strict();

export const CampaignNationReactionSchema = z
  .object({
    id: z.string(),
    worldEventId: EventIdSchema,
    nationId: NationIdSchema,
    stance: z.enum(["supportive", "cautious", "opposed", "neutral"]),
    sentimentBps: z.number().int().min(-10_000).max(10_000),
    statementKo: z.string().min(1).max(1_200),
  })
  .strict();

export const TimelineProgressionResultSchema = z
  .object({
    mode: z.enum(["months", "until_major_event"]),
    advanceDays: z.number().int().nonnegative().max(548),
    steps: z.number().int().nonnegative().max(24),
    stopReason: z.enum(["requested_duration", "major_event", "horizon_reached"]),
    majorEventId: EventIdSchema.optional(),
  })
  .strict();
