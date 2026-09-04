import { z } from "zod";

import { EventImpactSchema } from "./event-impact";

const orderedUniqueNationIds = z
  .array(z.string().regex(/^nat_[a-z0-9_]+$/))
  .refine((nationIds) => new Set(nationIds).size === nationIds.length, {
    message: "WORLD_EVENT_NATIONS_DUPLICATED",
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
    impacts: EventImpactSchema.optional(),
    provenance: z
      .enum(["historical_baseline", "player_divergence", "simulated_consequence", "unknown"])
      .optional(),
    regionIds: z.array(z.string()).optional(),
    sourceInputIds: z.array(z.string()).optional(),
  })
  .strict()
  .readonly();

export type CampaignWorldEvent = z.infer<typeof CampaignWorldEventSchema>;
