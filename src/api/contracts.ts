import { z } from "zod";

export const CreateCampaignRequestSchema = z
  .object({
    scenarioId: z.string().regex(/^scn_[a-z0-9_]+$/),
    playerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    customPolityName: z.string().trim().min(1).max(80).optional(),
    difficulty: z.enum(["story", "standard", "hard"]).optional(),
  })
  .strict();

export const AdvanceTurnRequestSchema = z
  .object({
    provider: z.enum(["deterministic", "codex", "claude"]),
    requestId: z.string().regex(/^req_[a-z0-9_]+$/),
    orderText: z.string().trim().min(1).max(4_000),
  })
  .strict();

export const ProposeTreatyRequestSchema = z
  .object({
    targetNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    clause: z.enum(["alliance", "non_aggression", "trade", "military_access"]),
  })
  .strict();

export const DiplomacyChatRequestSchema = z
  .object({
    targetNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    message: z.string().trim().min(1).max(4_000),
  })
  .strict();

export const TransferTerritoryRequestSchema = z
  .object({
    targetNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    provinceId: z.string().min(1),
  })
  .strict();

export const DeclareWarRequestSchema = z
  .object({
    targetNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
  })
  .strict();

export const RecruitUnitRequestSchema = z
  .object({
    provinceId: z.string().min(1),
  })
  .strict();

export const MoveUnitRequestSchema = z
  .object({
    unitId: z.string().min(1),
    provinceId: z.string().min(1),
  })
  .strict();

export const JumpTimelineRequestSchema = z
  .object({
    cadence: z.enum(["week", "month", "quarter", "year", "major"]),
  })
  .strict();
