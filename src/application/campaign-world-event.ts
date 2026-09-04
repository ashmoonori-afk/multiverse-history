import { z } from "zod";

import { EventImpactSchema } from "./event-impact";

const orderedUniqueNationIds = z
  .array(z.string().regex(/^nat_[a-z0-9_]+$/))
  .refine((nationIds) => new Set(nationIds).size === nationIds.length, {
    message: "WORLD_EVENT_NATIONS_DUPLICATED",
  })
  .readonly();

const orderedUniqueRegionIds = z
  .array(z.string().regex(/^prv_[a-z0-9_]+$/))
  .refine((regionIds) => new Set(regionIds).size === regionIds.length, {
    message: "WORLD_EVENT_REGIONS_DUPLICATED",
  })
  .readonly();

const orderedUniqueSourceInputIds = z
  .array(z.string().regex(/^(?:chat|req)_[a-z0-9_]+$/))
  .refine((sourceInputIds) => new Set(sourceInputIds).size === sourceInputIds.length, {
    message: "WORLD_EVENT_SOURCE_INPUTS_DUPLICATED",
  })
  .readonly();

export const CampaignWorldEventSchema = z
  .object({
    id: z.string().regex(/^evt_[a-z0-9_]+$/),
    kind: z.enum(["economic", "diplomatic", "military", "political"]),
    importance: z.enum(["minor", "major"]),
    occurredAtElapsedDays: z.number().safe().int().nonnegative(),
    turn: z.number().safe().int().nonnegative(),
    date: z
      .object({
        year: z.number().safe().int(),
        quarter: z.number().safe().int().min(1).max(4),
      })
      .strict()
      .readonly(),
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
  .strict()
  .readonly();

export type CampaignWorldEvent = z.infer<typeof CampaignWorldEventSchema>;
