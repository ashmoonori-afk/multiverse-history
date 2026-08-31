import { z } from "zod";

export const CampaignNationReactionSchema = z
  .object({
    id: z.string().regex(/^rct_[a-z0-9_]+$/),
    worldEventId: z.string().regex(/^evt_[a-z0-9_]+$/),
    nationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    stance: z.enum(["supportive", "cautious", "opposed", "neutral"]),
    sentimentBps: z.number().safe().int().min(-10_000).max(10_000),
    statementKo: z.string().min(1).max(1_200),
  })
  .strict()
  .readonly();

export type CampaignNationReaction = z.infer<typeof CampaignNationReactionSchema>;
