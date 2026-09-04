import { z } from "zod";

export const MAX_STRATEGIC_IDENTIFIER_LENGTH = 128;
export const MAX_PEACE_TERMS = 16;

export const NationIdSchema = z
  .string()
  .max(MAX_STRATEGIC_IDENTIFIER_LENGTH)
  .regex(/^nat_[a-z0-9_]+$/);
export const ProvinceIdSchema = z
  .string()
  .max(MAX_STRATEGIC_IDENTIFIER_LENGTH)
  .regex(/^prv_[a-z0-9_]+$/);
export const TreatyIdSchema = z
  .string()
  .max(MAX_STRATEGIC_IDENTIFIER_LENGTH)
  .regex(/^try_[a-z0-9_]+$/);
export const WarIdSchema = z
  .string()
  .max(MAX_STRATEGIC_IDENTIFIER_LENGTH)
  .regex(/^war_[a-z0-9_]+$/);
export const UnitIdSchema = z
  .string()
  .max(MAX_STRATEGIC_IDENTIFIER_LENGTH)
  .regex(/^unt_[a-z0-9_]+$/);
export const SectorSchema = z.string().regex(/^[a-z_]{2,24}$/);
export const ReasonKoSchema = z.string().trim().min(1).max(300);
export const SourceQuoteKoValueSchema = z.string().min(2).max(200);
export const TreatyClauseSchema = z.enum([
  "trade",
  "port_access",
  "weapons_support",
  "officer_training",
]);

export type StrategicTreatyClause = z.infer<typeof TreatyClauseSchema>;

export const withSourceQuoteKo = <Shape extends z.ZodRawShape>(shape: Shape) => ({
  ...shape,
  sourceQuoteKo: SourceQuoteKoValueSchema.optional(),
});

const InvestIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("economy.invest"),
      actorNationId: NationIdSchema,
      provinceId: ProvinceIdSchema,
      sector: SectorSchema,
      budgetCredits: z.number().safe().int().min(20).max(100),
    }),
  )
  .strict();

const TreatyIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("diplomacy.propose_treaty"),
      actorNationId: NationIdSchema,
      recipientNationId: NationIdSchema,
      provinceId: ProvinceIdSchema.optional(),
      clauses: z.array(TreatyClauseSchema).min(1).max(4).readonly(),
      termsKo: z.string().trim().min(1).max(4_000).optional(),
    }),
  )
  .strict();

const RecruitIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("military.recruit"),
      actorNationId: NationIdSchema,
      provinceId: ProvinceIdSchema,
      manpower: z.number().safe().int().min(100).max(100_000),
    }),
  )
  .strict();

export const TerritoryTransferIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("territory.transfer"),
      actorNationId: NationIdSchema,
      provinceId: ProvinceIdSchema,
      fromNationId: NationIdSchema,
      toNationId: NationIdSchema,
      reasonKo: ReasonKoSchema,
    }),
  )
  .strict();

const NationAdjustIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("nation.adjust"),
      nationId: NationIdSchema,
      treasuryDelta: z.number().safe().int().optional(),
      stabilityDelta: z.number().safe().int().min(-10_000).max(10_000).optional(),
      gdpDelta: z.number().safe().int().optional(),
      taxRateBps: z.number().safe().int().min(0).max(10_000).optional(),
      reasonKo: ReasonKoSchema,
    }),
  )
  .strict();

const RelationAdjustIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("relation.adjust"),
      fromNationId: NationIdSchema,
      toNationId: NationIdSchema,
      delta: z.number().safe().int().min(-3_000).max(3_000),
      reasonKo: ReasonKoSchema,
    }),
  )
  .strict();

const TreatyRespondIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("treaty.respond"),
      treatyId: TreatyIdSchema,
      decision: z.enum(["accept", "reject"]),
      actorNationId: NationIdSchema,
    }),
  )
  .strict();

const TreatyTerminateIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("treaty.terminate"),
      treatyId: TreatyIdSchema,
      actorNationId: NationIdSchema,
      reasonKo: ReasonKoSchema,
    }),
  )
  .strict();

const WarDeclareIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("war.declare"),
      actorNationId: NationIdSchema,
      targetNationId: NationIdSchema,
      casusBelliKo: ReasonKoSchema,
    }),
  )
  .strict();

const WarPeaceIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("war.peace"),
      actorNationId: NationIdSchema,
      warId: WarIdSchema,
      terms: z.array(TerritoryTransferIntentSchema).max(MAX_PEACE_TERMS).readonly(),
      reparationsCredits: z.number().safe().int().nonnegative().optional(),
    }),
  )
  .strict();

const UnitMoveIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("unit.move"),
      actorNationId: NationIdSchema,
      unitId: UnitIdSchema,
      toProvinceId: ProvinceIdSchema,
    }),
  )
  .strict();

const UnitAttackIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("unit.attack"),
      actorNationId: NationIdSchema,
      unitId: UnitIdSchema,
      targetProvinceId: ProvinceIdSchema,
    }),
  )
  .strict();

const UnitDisbandIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("unit.disband"),
      actorNationId: NationIdSchema,
      unitId: UnitIdSchema,
    }),
  )
  .strict();

const PolityChangeIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("polity.change"),
      nationId: NationIdSchema,
      nameKo: z.string().trim().min(1).max(200).optional(),
      governmentKo: z.string().trim().min(1).max(200).optional(),
      capitalProvinceId: ProvinceIdSchema.optional(),
    }),
  )
  .strict();

const ActionFailIntentSchema = z
  .object(
    withSourceQuoteKo({
      type: z.literal("action.fail"),
      actorNationId: NationIdSchema,
      attemptKo: ReasonKoSchema,
      stabilityDelta: z.number().safe().int().min(-500).max(0),
    }),
  )
  .strict();

export const StrategicIntentSchema = z.discriminatedUnion("type", [
  InvestIntentSchema,
  TreatyIntentSchema,
  RecruitIntentSchema,
  TerritoryTransferIntentSchema,
  NationAdjustIntentSchema,
  RelationAdjustIntentSchema,
  TreatyRespondIntentSchema,
  TreatyTerminateIntentSchema,
  WarDeclareIntentSchema,
  WarPeaceIntentSchema,
  UnitMoveIntentSchema,
  UnitAttackIntentSchema,
  UnitDisbandIntentSchema,
  PolityChangeIntentSchema,
  ActionFailIntentSchema,
]);

export type StrategicIntent = z.infer<typeof StrategicIntentSchema>;
