import { z } from "zod";

export const CampaignConstructionProjectSchema = z
  .object({
    id: z.string(),
    ownerNationId: z.string(),
    provinceId: z.string(),
    kind: z.literal("rail"),
    investedCredits: z.number().int().positive(),
    startedTurn: z.number().int().nonnegative(),
    status: z.literal("active"),
  })
  .strict();

const orderedUniqueNationIds = z
  .array(z.string())
  .refine((nationIds) => new Set(nationIds).size === nationIds.length);

export const CampaignWorldEventSchema = z
  .object({
    id: z.string(),
    kind: z.enum(["economic", "diplomatic", "military", "political"]),
    importance: z.enum(["minor", "major"]),
    occurredAtElapsedDays: z.number().int().nonnegative(),
    turn: z.number().int().nonnegative(),
    date: z.object({ year: z.number().int(), quarter: z.number().int().min(1).max(4) }).strict(),
    actorNationIds: orderedUniqueNationIds,
    affectedNationIds: orderedUniqueNationIds,
    headlineKo: z.string().min(1).max(160),
    summaryKo: z.string().min(1).max(1_200),
    sourceResolutionId: z.string().optional(),
  })
  .strict();

export const CampaignNationReactionSchema = z
  .object({
    id: z.string(),
    worldEventId: z.string(),
    nationId: z.string(),
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
    majorEventId: z.string().optional(),
  })
  .strict();
