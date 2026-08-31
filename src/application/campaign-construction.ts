import { z } from "zod";

export const CampaignConstructionProjectSchema = z
  .object({
    id: z.string().regex(/^cst_[a-z0-9_]+$/),
    ownerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    provinceId: z.string().regex(/^prv_[a-z0-9_]+$/),
    kind: z.literal("rail"),
    investedCredits: z.number().safe().int().positive(),
    startedTurn: z.number().safe().int().nonnegative(),
    status: z.literal("active"),
  })
  .strict()
  .readonly();

export type CampaignConstructionProject = z.infer<typeof CampaignConstructionProjectSchema>;
