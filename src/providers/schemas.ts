import { z } from "zod";

export type StrategicIntent =
  | {
      readonly type: "economy.invest";
      readonly actorNationId: string;
      readonly provinceId: string;
      readonly sector: "rail";
      readonly budgetCredits: number;
    }
  | {
      readonly type: "diplomacy.propose_treaty";
      readonly actorNationId: string;
      readonly recipientNationId: string;
      readonly clauses: readonly "trade"[];
    }
  | {
      readonly type: "military.recruit";
      readonly actorNationId: string;
      readonly provinceId: string;
      readonly manpower: number;
    };

export interface StrategicPlan {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly playerIntents: readonly StrategicIntent[];
  readonly npcIntents: readonly StrategicIntent[];
  readonly narrative: { readonly ko: string };
  readonly warnings: readonly string[];
}

const NationIdSchema = z.string().regex(/^nat_[a-z0-9_]+$/);
const ProvinceIdSchema = z.string().regex(/^prv_[a-z0-9_]+$/);

const InvestIntentSchema = z
  .object({
    type: z.literal("economy.invest"),
    actorNationId: NationIdSchema,
    provinceId: ProvinceIdSchema,
    sector: z.literal("rail"),
    budgetCredits: z.number().safe().int().min(20).max(100),
  })
  .strict();

const TreatyIntentSchema = z
  .object({
    type: z.literal("diplomacy.propose_treaty"),
    actorNationId: NationIdSchema,
    recipientNationId: NationIdSchema,
    clauses: z.array(z.literal("trade")).length(1).readonly(),
  })
  .strict();

const RecruitIntentSchema = z
  .object({
    type: z.literal("military.recruit"),
    actorNationId: NationIdSchema,
    provinceId: ProvinceIdSchema,
    manpower: z.number().safe().int().min(100).max(100_000),
  })
  .strict();

const StrategicIntentSchema = z.discriminatedUnion("type", [
  InvestIntentSchema,
  TreatyIntentSchema,
  RecruitIntentSchema,
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
    type: z.enum(["economy.invest", "diplomacy.propose_treaty", "military.recruit"]),
    actorNationId: NationIdSchema,
    provinceId: ProvinceIdSchema.nullish(),
    recipientNationId: NationIdSchema.nullish(),
    sector: z.literal("rail").nullish(),
    budgetCredits: z.number().safe().int().min(20).max(100).nullish(),
    clauses: z.array(z.literal("trade")).max(1).nullish(),
    manpower: z.number().safe().int().min(100).max(100_000).nullish(),
  })
  .strict();

const WirePlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: z.string().regex(/^req_[a-z0-9_]+$/),
    playerIntents: z.array(WireIntentSchema).max(8),
    npcIntents: z.array(WireIntentSchema).min(1).max(16),
    narrative: z.object({ ko: z.string().trim().min(1).max(2_000) }).strict(),
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
  switch (intent.type) {
    case "economy.invest":
      return {
        type: intent.type,
        actorNationId: intent.actorNationId,
        provinceId: requiredWireValue(intent.provinceId, "provinceId"),
        sector: requiredWireValue(intent.sector, "sector"),
        budgetCredits: requiredWireValue(intent.budgetCredits, "budgetCredits"),
      };
    case "diplomacy.propose_treaty":
      return {
        type: intent.type,
        actorNationId: intent.actorNationId,
        recipientNationId: requiredWireValue(intent.recipientNationId, "recipientNationId"),
        clauses: requiredWireValue(intent.clauses, "clauses"),
      };
    case "military.recruit":
      return {
        type: intent.type,
        actorNationId: intent.actorNationId,
        provinceId: requiredWireValue(intent.provinceId, "provinceId"),
        manpower: requiredWireValue(intent.manpower, "manpower"),
      };
  }
};

export const parseStrategicPlan = (value: unknown): StrategicPlan =>
  StrategicPlanSchema.parse(value);

export const parseProviderStrategicPlan = (value: unknown): StrategicPlan => {
  const wire = WirePlanSchema.parse(value);
  return parseStrategicPlan({
    ...wire,
    playerIntents: wire.playerIntents.map(normalizeWireIntent),
    npcIntents: wire.npcIntents.map(normalizeWireIntent),
  });
};

const nullable = (type: "string" | "integer"): object => ({ type: [type, "null"] });

const wireIntentJsonSchema = (): object => ({
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["economy.invest", "diplomacy.propose_treaty", "military.recruit"],
    },
    actorNationId: { type: "string", pattern: "^nat_[a-z0-9_]+$" },
    provinceId: { ...nullable("string"), pattern: "^prv_[a-z0-9_]+$" },
    recipientNationId: { ...nullable("string"), pattern: "^nat_[a-z0-9_]+$" },
    sector: { type: ["string", "null"], enum: ["rail", null] },
    budgetCredits: { ...nullable("integer"), minimum: 20, maximum: 100 },
    clauses: {
      type: ["array", "null"],
      items: { type: "string", enum: ["trade"] },
      maxItems: 1,
    },
    manpower: { ...nullable("integer"), minimum: 100, maximum: 100_000 },
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
    warnings: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 300 },
      maxItems: 8,
    },
  },
  required: ["schemaVersion", "requestId", "playerIntents", "npcIntents", "narrative", "warnings"],
  additionalProperties: false,
});
