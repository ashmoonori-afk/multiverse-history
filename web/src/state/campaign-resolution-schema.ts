import { z } from "zod";

const NumericDeltaSchema = z
  .object({
    before: z.number().int(),
    after: z.number().int(),
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
          nationId: z.string(),
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
          fromNationId: z.string(),
          toNationId: z.string(),
          before: z.number().int(),
          after: z.number().int(),
        })
        .strict(),
    ),
    treatyDeltas: z.array(
      z
        .object({
          id: z.string(),
          proposerNationId: z.string(),
          recipientNationId: z.string(),
          clauses: z.array(z.string()),
          status: z.enum(["proposed", "active"]),
          proposedTurn: z.number().int().nonnegative(),
        })
        .strict(),
    ),
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
              })
              .strict(),
          )
          .default([]),
      })
      .strict(),
  })
  .strict();

export type CampaignResolution = z.infer<typeof CampaignResolutionSchema>;
