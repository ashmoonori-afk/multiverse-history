import { z } from "zod";

import {
  parseTurnPresentation,
  type TurnPresentation,
  turnPresentationJsonSchema,
} from "./turn-presentation";

export type StrategicIntent =
  | {
      readonly type: "economy.invest";
      readonly actorNationId: string;
      readonly provinceId: string;
      readonly sector: string;
      readonly budgetCredits: number;
      readonly sourceQuoteKo?: string | undefined;
    }
  | {
      readonly type: "diplomacy.propose_treaty";
      readonly actorNationId: string;
      readonly recipientNationId: string;
      readonly provinceId?: string | undefined;
      readonly clauses: readonly StrategicTreatyClause[];
      readonly termsKo?: string | undefined;
      readonly sourceQuoteKo?: string | undefined;
    }
  | {
      readonly type: "military.recruit";
      readonly actorNationId: string;
      readonly provinceId: string;
      readonly manpower: number;
      readonly sourceQuoteKo?: string | undefined;
    }
  | {
      readonly type: "territory.transfer";
      readonly actorNationId: string;
      readonly provinceId: string;
      readonly fromNationId: string;
      readonly toNationId: string;
      readonly reasonKo: string;
      readonly sourceQuoteKo?: string | undefined;
    };

export type StrategicTreatyClause =
  | "trade"
  | "port_access"
  | "weapons_support"
  | "officer_training";

export interface StrategicPlan {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly playerIntents: readonly StrategicIntent[];
  readonly npcIntents: readonly StrategicIntent[];
  readonly narrative: { readonly ko: string };
  readonly presentation?: TurnPresentation | undefined;
  readonly warnings: readonly string[];
}

export const strategicPlanCore = (plan: StrategicPlan): StrategicPlan =>
  Object.freeze({
    schemaVersion: plan.schemaVersion,
    requestId: plan.requestId,
    playerIntents: plan.playerIntents,
    npcIntents: plan.npcIntents,
    narrative: plan.narrative,
    warnings: plan.warnings,
  });

const NationIdSchema = z.string().regex(/^nat_[a-z0-9_]+$/);
const ProvinceIdSchema = z.string().regex(/^prv_[a-z0-9_]+$/);
const SectorSchema = z.string().regex(/^[a-z_]{2,24}$/);
const SourceQuoteSchema = z.string().min(2).max(200).optional();

const InvestIntentSchema = z
  .object({
    type: z.literal("economy.invest"),
    actorNationId: NationIdSchema,
    provinceId: ProvinceIdSchema,
    sector: SectorSchema,
    budgetCredits: z.number().safe().int().min(20).max(100),
    sourceQuoteKo: SourceQuoteSchema,
  })
  .strict();

const TreatyIntentSchema = z
  .object({
    type: z.literal("diplomacy.propose_treaty"),
    actorNationId: NationIdSchema,
    recipientNationId: NationIdSchema,
    provinceId: ProvinceIdSchema.optional(),
    clauses: z
      .array(z.enum(["trade", "port_access", "weapons_support", "officer_training"]))
      .min(1)
      .max(4)
      .readonly(),
    termsKo: z.string().trim().min(1).max(4_000).optional(),
    sourceQuoteKo: SourceQuoteSchema,
  })
  .strict();

const RecruitIntentSchema = z
  .object({
    type: z.literal("military.recruit"),
    actorNationId: NationIdSchema,
    provinceId: ProvinceIdSchema,
    manpower: z.number().safe().int().min(100).max(100_000),
    sourceQuoteKo: SourceQuoteSchema,
  })
  .strict();

const TerritoryTransferIntentSchema = z
  .object({
    type: z.literal("territory.transfer"),
    actorNationId: NationIdSchema,
    provinceId: ProvinceIdSchema,
    fromNationId: NationIdSchema,
    toNationId: NationIdSchema,
    reasonKo: z.string().trim().min(1).max(300),
    sourceQuoteKo: SourceQuoteSchema,
  })
  .strict();

const StrategicIntentSchema = z.discriminatedUnion("type", [
  InvestIntentSchema,
  TreatyIntentSchema,
  RecruitIntentSchema,
  TerritoryTransferIntentSchema,
]);

const StrategicPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: z.string().regex(/^req_[a-z0-9_]+$/),
    playerIntents: z.array(StrategicIntentSchema).max(8).readonly(),
    npcIntents: z.array(StrategicIntentSchema).min(1).max(16).readonly(),
    narrative: z
      .object({
        ko: z.string().trim().min(1).max(2_000),
      })
      .strict()
      .readonly(),
    warnings: z.array(z.string().trim().min(1).max(300)).max(8).readonly(),
  })
  .strict()
  .readonly();

const WireIntentSchema = z
  .object({
    type: z.enum([
      "economy.invest",
      "diplomacy.propose_treaty",
      "military.recruit",
      "territory.transfer",
    ]),
    actorNationId: NationIdSchema,
    provinceId: ProvinceIdSchema.nullish(),
    recipientNationId: NationIdSchema.nullish(),
    fromNationId: NationIdSchema.nullish(),
    toNationId: NationIdSchema.nullish(),
    reasonKo: z.string().trim().min(1).max(300).nullish(),
    sector: SectorSchema.nullish(),
    budgetCredits: z.number().safe().int().min(20).max(100).nullish(),
    clauses: z
      .array(z.enum(["trade", "port_access", "weapons_support", "officer_training"]))
      .max(4)
      .nullish(),
    manpower: z.number().safe().int().min(100).max(100_000).nullish(),
    sourceQuoteKo: z.string().min(2).max(200).nullish(),
  })
  .strict();

const WirePlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: z.string().regex(/^req_[a-z0-9_]+$/),
    playerIntents: z.array(WireIntentSchema).max(8),
    npcIntents: z.array(WireIntentSchema).min(1).max(16),
    narrative: z.object({ ko: z.string().trim().min(1).max(2_000) }).strict(),
    presentation: z.unknown(),
    warnings: z.array(z.string().trim().min(1).max(300)).max(8),
  })
  .strict();

const requiredWireValue = <Value>(value: Value | null | undefined, field: string): Value => {
  if (value === null || value === undefined) {
    throw new TypeError(`PROVIDER_SCHEMA_INVALID:${field}`);
  }
  return value;
};

const normalizeWireIntent = (intent: z.infer<typeof WireIntentSchema>): StrategicIntent => {
  const sourceQuote =
    intent.sourceQuoteKo === null || intent.sourceQuoteKo === undefined
      ? {}
      : { sourceQuoteKo: intent.sourceQuoteKo };
  switch (intent.type) {
    case "economy.invest":
      return {
        type: intent.type,
        actorNationId: intent.actorNationId,
        provinceId: requiredWireValue(intent.provinceId, "provinceId"),
        sector: requiredWireValue(intent.sector, "sector"),
        budgetCredits: requiredWireValue(intent.budgetCredits, "budgetCredits"),
        ...sourceQuote,
      };
    case "diplomacy.propose_treaty":
      return {
        type: intent.type,
        actorNationId: intent.actorNationId,
        recipientNationId: requiredWireValue(intent.recipientNationId, "recipientNationId"),
        clauses: requiredWireValue(intent.clauses, "clauses"),
        ...(intent.provinceId === null || intent.provinceId === undefined
          ? {}
          : { provinceId: intent.provinceId }),
        ...sourceQuote,
      };
    case "military.recruit":
      return {
        type: intent.type,
        actorNationId: intent.actorNationId,
        provinceId: requiredWireValue(intent.provinceId, "provinceId"),
        manpower: requiredWireValue(intent.manpower, "manpower"),
        ...sourceQuote,
      };
    case "territory.transfer":
      return {
        type: intent.type,
        actorNationId: intent.actorNationId,
        provinceId: requiredWireValue(intent.provinceId, "provinceId"),
        fromNationId: requiredWireValue(intent.fromNationId, "fromNationId"),
        toNationId: requiredWireValue(intent.toNationId, "toNationId"),
        reasonKo: requiredWireValue(intent.reasonKo, "reasonKo"),
        ...sourceQuote,
      };
  }
};

export const parseStrategicPlan = (value: unknown): StrategicPlan =>
  StrategicPlanSchema.parse(value);

export const parseProviderStrategicPlan = (value: unknown): StrategicPlan => {
  const wire = WirePlanSchema.parse(value);
  const plan = parseStrategicPlan({
    schemaVersion: wire.schemaVersion,
    requestId: wire.requestId,
    playerIntents: wire.playerIntents.map(normalizeWireIntent),
    npcIntents: wire.npcIntents.map(normalizeWireIntent),
    narrative: wire.narrative,
    warnings: wire.warnings,
  });
  return Object.freeze({ ...plan, presentation: parseTurnPresentation(wire.presentation) });
};

const nullable = (type: "string" | "integer"): object => ({ type: [type, "null"] });

const wireIntentJsonSchema = (): object => ({
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: [
        "economy.invest",
        "diplomacy.propose_treaty",
        "military.recruit",
        "territory.transfer",
      ],
    },
    actorNationId: { type: "string", pattern: "^nat_[a-z0-9_]+$" },
    provinceId: { ...nullable("string"), pattern: "^prv_[a-z0-9_]+$" },
    recipientNationId: { ...nullable("string"), pattern: "^nat_[a-z0-9_]+$" },
    fromNationId: { ...nullable("string"), pattern: "^nat_[a-z0-9_]+$" },
    toNationId: { ...nullable("string"), pattern: "^nat_[a-z0-9_]+$" },
    reasonKo: { ...nullable("string"), minLength: 1, maxLength: 300 },
    sector: { ...nullable("string"), pattern: "^[a-z_]{2,24}$" },
    budgetCredits: { ...nullable("integer"), minimum: 20, maximum: 100 },
    clauses: {
      type: ["array", "null"],
      items: {
        type: "string",
        enum: ["trade", "port_access", "weapons_support", "officer_training"],
      },
      maxItems: 4,
    },
    manpower: { ...nullable("integer"), minimum: 100, maximum: 100_000 },
    sourceQuoteKo: { ...nullable("string"), minLength: 2, maxLength: 200 },
  },
  required: [
    "type",
    "actorNationId",
    "provinceId",
    "recipientNationId",
    "sector",
    "budgetCredits",
    "clauses",
    "manpower",
    "fromNationId",
    "toNationId",
    "reasonKo",
    "sourceQuoteKo",
  ],
  additionalProperties: false,
});

export const strategicPlanJsonSchema = (): unknown => ({
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    schemaVersion: { type: "integer", const: 1 },
    requestId: { type: "string", pattern: "^req_[a-z0-9_]+$" },
    playerIntents: { type: "array", items: wireIntentJsonSchema(), maxItems: 8 },
    npcIntents: { type: "array", items: wireIntentJsonSchema(), minItems: 1, maxItems: 16 },
    narrative: {
      type: "object",
      properties: { ko: { type: "string", minLength: 1, maxLength: 2_000 } },
      required: ["ko"],
      additionalProperties: false,
    },
    presentation: turnPresentationJsonSchema(),
    warnings: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 300 },
      maxItems: 8,
    },
  },
  required: [
    "schemaVersion",
    "requestId",
    "playerIntents",
    "npcIntents",
    "narrative",
    "presentation",
    "warnings",
  ],
  additionalProperties: false,
});
