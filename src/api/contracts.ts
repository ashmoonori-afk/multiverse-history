import { z } from "zod";

export const CreateCampaignRequestSchema = z
  .object({
    scenarioId: z.string().regex(/^scn_[a-z0-9_]+$/),
    playerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    provider: z.enum(["deterministic", "codex", "claude"]).default("deterministic"),
    customPolityName: z.string().trim().min(1).max(80).optional(),
    difficulty: z.enum(["story", "standard", "hard"]).optional(),
  })
  .strict();

export const AdvanceTurnRequestSchema = z
  .object({
    provider: z.enum(["deterministic", "codex", "claude"]),
    requestId: z.string().regex(/^req_[a-z0-9_]+$/),
    orderText: z.string().trim().min(1).max(4_000),
    cadence: z.enum(["week", "month", "quarter", "year", "major"]).default("quarter"),
  })
  .strict();

export const ProposeTreatyRequestSchema = z
  .object({
    targetNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    clause: z.enum(["alliance", "non_aggression", "trade", "military_access"]),
  })
  .strict();

const DiplomacyChatFields = {
  message: z.string().trim().min(1).max(4_000),
  provider: z.enum(["deterministic", "codex", "claude"]).default("deterministic"),
} as const;

const SingularDiplomacyChatRequestSchema = z
  .object({
    targetNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    ...DiplomacyChatFields,
  })
  .strict();

const GroupDiplomacyChatRequestSchema = z
  .object({
    targetNationIds: z
      .array(z.string().regex(/^nat_[a-z0-9_]+$/))
      .min(1)
      .max(8)
      .refine((nationIds) => new Set(nationIds).size === nationIds.length, {
        message: "CHAT_TARGETS_DUPLICATED",
      }),
    ...DiplomacyChatFields,
  })
  .strict();

export const DiplomacyChatRequestSchema = z
  .union([GroupDiplomacyChatRequestSchema, SingularDiplomacyChatRequestSchema])
  .transform((request) => ({
    targetNationIds:
      "targetNationIds" in request
        ? Object.freeze([...request.targetNationIds])
        : Object.freeze([request.targetNationId]),
    message: request.message,
    provider: request.provider,
  }));

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

const LegacyTimelineJumpRequestSchema = z
  .object({
    cadence: z.enum(["week", "month", "quarter", "year", "major"]),
  })
  .strict();

const TimelineProgressionRequestSchema = z
  .object({
    progression: z.discriminatedUnion("mode", [
      z
        .object({
          mode: z.literal("months"),
          months: z.number().safe().int().min(1).max(18),
        })
        .strict(),
      z.object({ mode: z.literal("until_major_event") }).strict(),
    ]),
  })
  .strict();

export const JumpTimelineRequestSchema = z.union([
  LegacyTimelineJumpRequestSchema,
  TimelineProgressionRequestSchema,
]);
