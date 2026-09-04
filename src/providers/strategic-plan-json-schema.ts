import type { StrategicIntent } from "./strategic-intent-schema";
import { TreatyClauseSchema } from "./strategic-intent-schema";
import { turnPresentationJsonSchema } from "./turn-presentation";

const nullable = (type: "string" | "integer" | "array"): object => ({
  type: [type, "null"],
});

const stringId = (prefix: string): object => ({
  type: "string",
  pattern: `^${prefix}_[a-z0-9_]+$`,
});

const nullableId = (prefix: string): object => ({
  ...nullable("string"),
  pattern: `^${prefix}_[a-z0-9_]+$`,
});

const nullableReason = (): object => ({
  ...nullable("string"),
  minLength: 1,
  maxLength: 300,
});

const nullableSourceQuote = (): object => ({
  ...nullable("string"),
  minLength: 2,
  maxLength: 200,
});

const wireVariantJsonSchema = (
  type: StrategicIntent["type"],
  properties: Readonly<Record<string, object>>,
): object => ({
  type: "object",
  properties: {
    type: { type: "string", enum: [type] },
    ...properties,
    sourceQuoteKo: nullableSourceQuote(),
  },
  required: ["type", ...Object.keys(properties), "sourceQuoteKo"],
  additionalProperties: false,
});

const economyIntentJsonSchema = (): object =>
  wireVariantJsonSchema("economy.invest", {
    actorNationId: stringId("nat"),
    provinceId: nullableId("prv"),
    sector: { ...nullable("string"), pattern: "^[a-z_]{2,24}$" },
    budgetCredits: { ...nullable("integer"), minimum: 20, maximum: 100 },
  });

const diplomacyIntentJsonSchema = (): object =>
  wireVariantJsonSchema("diplomacy.propose_treaty", {
    actorNationId: stringId("nat"),
    recipientNationId: nullableId("nat"),
    provinceId: nullableId("prv"),
    clauses: {
      ...nullable("array"),
      items: { type: "string", enum: TreatyClauseSchema.options },
      minItems: 1,
      maxItems: 4,
    },
    termsKo: { ...nullable("string"), minLength: 1, maxLength: 4_000 },
  });

const militaryIntentJsonSchema = (): object =>
  wireVariantJsonSchema("military.recruit", {
    actorNationId: stringId("nat"),
    provinceId: nullableId("prv"),
    manpower: { ...nullable("integer"), minimum: 100, maximum: 100_000 },
  });

const territoryIntentJsonSchema = (): object =>
  wireVariantJsonSchema("territory.transfer", {
    actorNationId: stringId("nat"),
    provinceId: nullableId("prv"),
    fromNationId: nullableId("nat"),
    toNationId: nullableId("nat"),
    reasonKo: nullableReason(),
  });

const nationIntentJsonSchema = (): object =>
  wireVariantJsonSchema("nation.adjust", {
    nationId: nullableId("nat"),
    treasuryDelta: nullable("integer"),
    stabilityDelta: { ...nullable("integer"), minimum: -10_000, maximum: 10_000 },
    gdpDelta: nullable("integer"),
    taxRateBps: { ...nullable("integer"), minimum: 0, maximum: 10_000 },
    reasonKo: nullableReason(),
  });

const relationIntentJsonSchema = (): object =>
  wireVariantJsonSchema("relation.adjust", {
    fromNationId: nullableId("nat"),
    toNationId: nullableId("nat"),
    delta: { ...nullable("integer"), minimum: -3_000, maximum: 3_000 },
    reasonKo: nullableReason(),
  });

const treatyIntentJsonSchemas = (): readonly object[] => [
  wireVariantJsonSchema("treaty.respond", {
    treatyId: nullableId("try"),
    decision: { type: ["string", "null"], enum: ["accept", "reject", null] },
    actorNationId: stringId("nat"),
  }),
  wireVariantJsonSchema("treaty.terminate", {
    treatyId: nullableId("try"),
    actorNationId: stringId("nat"),
    reasonKo: nullableReason(),
  }),
];

const warIntentJsonSchemas = (): readonly object[] => [
  wireVariantJsonSchema("war.declare", {
    actorNationId: stringId("nat"),
    targetNationId: nullableId("nat"),
    casusBelliKo: nullableReason(),
  }),
  wireVariantJsonSchema("war.peace", {
    warId: nullableId("war"),
    terms: { ...nullable("array"), items: territoryIntentJsonSchema() },
    reparationsCredits: { ...nullable("integer"), minimum: 0 },
  }),
];

const unitIntentJsonSchemas = (): readonly object[] => [
  wireVariantJsonSchema("unit.move", {
    unitId: nullableId("unt"),
    toProvinceId: nullableId("prv"),
  }),
  wireVariantJsonSchema("unit.attack", {
    unitId: nullableId("unt"),
    targetProvinceId: nullableId("prv"),
  }),
  wireVariantJsonSchema("unit.disband", { unitId: nullableId("unt") }),
];

const polityIntentJsonSchema = (): object =>
  wireVariantJsonSchema("polity.change", {
    nationId: nullableId("nat"),
    nameKo: { ...nullable("string"), minLength: 1, maxLength: 200 },
    governmentKo: { ...nullable("string"), minLength: 1, maxLength: 200 },
    capitalProvinceId: nullableId("prv"),
  });

const actionIntentJsonSchema = (): object =>
  wireVariantJsonSchema("action.fail", {
    actorNationId: stringId("nat"),
    attemptKo: nullableReason(),
    stabilityDelta: { ...nullable("integer"), minimum: -500, maximum: 0 },
  });

const wireIntentJsonSchema = (): object => ({
  oneOf: [
    economyIntentJsonSchema(),
    diplomacyIntentJsonSchema(),
    militaryIntentJsonSchema(),
    territoryIntentJsonSchema(),
    nationIntentJsonSchema(),
    relationIntentJsonSchema(),
    ...treatyIntentJsonSchemas(),
    ...warIntentJsonSchemas(),
    ...unitIntentJsonSchemas(),
    polityIntentJsonSchema(),
    actionIntentJsonSchema(),
  ],
});

export const strategicPlanJsonSchema = (): object => ({
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    schemaVersion: { type: "integer", enum: [1, 2] },
    requestId: { type: "string", pattern: "^req_[a-z0-9_]+$" },
    playerIntents: { type: "array", items: wireIntentJsonSchema(), maxItems: 8 },
    npcIntents: { type: "array", items: wireIntentJsonSchema(), minItems: 1, maxItems: 32 },
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
