import { z } from "zod";

import {
  MAX_PEACE_TERMS,
  MAX_STRATEGIC_IDENTIFIER_LENGTH,
  NationIdSchema,
  ProvinceIdSchema,
  ReasonKoSchema,
  SectorSchema,
  SourceQuoteKoValueSchema,
  type StrategicIntent,
  StrategicIntentSchema,
  TreatyClauseSchema,
  TreatyIdSchema,
  UnitIdSchema,
  WarIdSchema,
} from "./strategic-intent-schema";

const wireIntent = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.object({ ...shape, sourceQuoteKo: SourceQuoteKoValueSchema.nullish() }).strict();

const WireInvestIntentSchema = wireIntent({
  type: z.literal("economy.invest"),
  actorNationId: NationIdSchema,
  provinceId: ProvinceIdSchema.nullish(),
  sector: SectorSchema.nullish(),
  budgetCredits: z.number().safe().int().min(20).max(100).nullish(),
});

const WireTreatyIntentSchema = wireIntent({
  type: z.literal("diplomacy.propose_treaty"),
  actorNationId: NationIdSchema,
  recipientNationId: NationIdSchema.nullish(),
  provinceId: ProvinceIdSchema.nullish(),
  clauses: z.array(TreatyClauseSchema).min(1).max(4).nullish(),
  termsKo: z.string().trim().min(1).max(4_000).nullish(),
});

const WireRecruitIntentSchema = wireIntent({
  type: z.literal("military.recruit"),
  actorNationId: NationIdSchema,
  provinceId: ProvinceIdSchema.nullish(),
  manpower: z.number().safe().int().min(100).max(100_000).nullish(),
});

const WireTerritoryTransferIntentSchema = wireIntent({
  type: z.literal("territory.transfer"),
  actorNationId: NationIdSchema,
  provinceId: ProvinceIdSchema.nullish(),
  fromNationId: NationIdSchema.nullish(),
  toNationId: NationIdSchema.nullish(),
  reasonKo: ReasonKoSchema.nullish(),
});

const WireNationAdjustIntentSchema = wireIntent({
  type: z.literal("nation.adjust"),
  nationId: NationIdSchema.nullish(),
  treasuryDelta: z.number().safe().int().nullish(),
  stabilityDelta: z.number().safe().int().min(-10_000).max(10_000).nullish(),
  gdpDelta: z.number().safe().int().nullish(),
  taxRateBps: z.number().safe().int().min(0).max(10_000).nullish(),
  reasonKo: ReasonKoSchema.nullish(),
});

const WireRelationAdjustIntentSchema = wireIntent({
  type: z.literal("relation.adjust"),
  fromNationId: NationIdSchema.nullish(),
  toNationId: NationIdSchema.nullish(),
  delta: z.number().safe().int().min(-3_000).max(3_000).nullish(),
  reasonKo: ReasonKoSchema.nullish(),
});

const WireTreatyRespondIntentSchema = wireIntent({
  type: z.literal("treaty.respond"),
  treatyId: TreatyIdSchema.nullish(),
  decision: z.enum(["accept", "reject"]).nullish(),
  actorNationId: NationIdSchema,
});

const WireTreatyTerminateIntentSchema = wireIntent({
  type: z.literal("treaty.terminate"),
  treatyId: TreatyIdSchema.nullish(),
  actorNationId: NationIdSchema,
  reasonKo: ReasonKoSchema.nullish(),
});

const WireWarDeclareIntentSchema = wireIntent({
  type: z.literal("war.declare"),
  actorNationId: NationIdSchema,
  targetNationId: NationIdSchema.nullish(),
  casusBelliKo: ReasonKoSchema.nullish(),
});

const WireWarPeaceIntentSchema = wireIntent({
  type: z.literal("war.peace"),
  actorNationId: NationIdSchema,
  warId: WarIdSchema.nullish(),
  terms: z.array(WireTerritoryTransferIntentSchema).max(MAX_PEACE_TERMS).nullish(),
  reparationsCredits: z.number().safe().int().nonnegative().nullish(),
});

const WireUnitMoveIntentSchema = wireIntent({
  type: z.literal("unit.move"),
  actorNationId: NationIdSchema,
  unitId: UnitIdSchema.nullish(),
  toProvinceId: ProvinceIdSchema.nullish(),
});

const WireUnitAttackIntentSchema = wireIntent({
  type: z.literal("unit.attack"),
  actorNationId: NationIdSchema,
  unitId: UnitIdSchema.nullish(),
  targetProvinceId: ProvinceIdSchema.nullish(),
});

const WireUnitDisbandIntentSchema = wireIntent({
  type: z.literal("unit.disband"),
  actorNationId: NationIdSchema,
  unitId: UnitIdSchema.nullish(),
});

const WirePolityChangeIntentSchema = wireIntent({
  type: z.literal("polity.change"),
  nationId: NationIdSchema.nullish(),
  nameKo: z.string().trim().min(1).max(200).nullish(),
  governmentKo: z.string().trim().min(1).max(200).nullish(),
  capitalProvinceId: ProvinceIdSchema.nullish(),
});

const WireActionFailIntentSchema = wireIntent({
  type: z.literal("action.fail"),
  actorNationId: NationIdSchema,
  attemptKo: ReasonKoSchema.nullish(),
  stabilityDelta: z.number().safe().int().min(-500).max(0).nullish(),
});

export const WireStrategicIntentSchema = z.discriminatedUnion("type", [
  WireInvestIntentSchema,
  WireTreatyIntentSchema,
  WireRecruitIntentSchema,
  WireTerritoryTransferIntentSchema,
  WireNationAdjustIntentSchema,
  WireRelationAdjustIntentSchema,
  WireTreatyRespondIntentSchema,
  WireTreatyTerminateIntentSchema,
  WireWarDeclareIntentSchema,
  WireWarPeaceIntentSchema,
  WireUnitMoveIntentSchema,
  WireUnitAttackIntentSchema,
  WireUnitDisbandIntentSchema,
  WirePolityChangeIntentSchema,
  WireActionFailIntentSchema,
]);

export const WireStrategicPlanSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    requestId: z
      .string()
      .max(MAX_STRATEGIC_IDENTIFIER_LENGTH)
      .regex(/^req_[a-z0-9_]+$/),
    playerIntents: z.array(WireStrategicIntentSchema).max(8),
    npcIntents: z.array(WireStrategicIntentSchema).min(1).max(32),
    narrative: z.object({ ko: z.string().trim().min(1).max(2_000) }).strict(),
    presentation: z.unknown(),
    warnings: z.array(z.string().trim().min(1).max(300)).max(8),
  })
  .strict();

export type WireStrategicPlan = z.infer<typeof WireStrategicPlanSchema>;

const stripNullish = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripNullish);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry) => entry[1] !== null && entry[1] !== undefined)
      .map(([key, entryValue]) => [key, stripNullish(entryValue)]),
  );
};

export const normalizeWireIntent = (
  intent: z.infer<typeof WireStrategicIntentSchema>,
): StrategicIntent => {
  switch (intent.type) {
    case "economy.invest":
    case "diplomacy.propose_treaty":
    case "military.recruit":
    case "territory.transfer":
    case "nation.adjust":
    case "relation.adjust":
    case "treaty.respond":
    case "treaty.terminate":
    case "war.declare":
    case "war.peace":
    case "unit.move":
    case "unit.attack":
    case "unit.disband":
    case "polity.change":
    case "action.fail":
      return StrategicIntentSchema.parse(stripNullish(intent));
  }
};
