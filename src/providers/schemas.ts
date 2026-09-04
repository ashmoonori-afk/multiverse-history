import { z } from "zod";

import { MAX_STRATEGIC_IDENTIFIER_LENGTH, StrategicIntentSchema } from "./strategic-intent-schema";
import {
  normalizeWireIntent,
  type WireStrategicPlan,
  WireStrategicPlanSchema,
} from "./strategic-intent-wire-schema";
import { parseTurnPresentation, type TurnPresentation } from "./turn-presentation";

export type {
  StrategicIntent,
  StrategicTreatyClause,
} from "./strategic-intent-schema";
export { strategicPlanJsonSchema } from "./strategic-plan-json-schema";

export interface StrategicPlan {
  readonly schemaVersion: 2;
  readonly requestId: string;
  readonly playerIntents: readonly z.infer<typeof StrategicIntentSchema>[];
  readonly npcIntents: readonly z.infer<typeof StrategicIntentSchema>[];
  readonly narrative: { readonly ko: string };
  readonly presentation?: TurnPresentation | undefined;
  readonly warnings: readonly string[];
}

export type StrategicPlanInput = Omit<StrategicPlan, "presentation" | "schemaVersion"> & {
  readonly schemaVersion: 1 | 2;
};

export const StrategicPlanInputSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    requestId: z
      .string()
      .max(MAX_STRATEGIC_IDENTIFIER_LENGTH)
      .regex(/^req_[a-z0-9_]+$/),
    playerIntents: z.array(StrategicIntentSchema).max(8).readonly(),
    npcIntents: z.array(StrategicIntentSchema).min(1).max(32).readonly(),
    narrative: z
      .object({ ko: z.string().trim().min(1).max(2_000) })
      .strict()
      .readonly(),
    warnings: z.array(z.string().trim().min(1).max(300)).max(8).readonly(),
  })
  .strict()
  .readonly();

export const strategicPlanCore = (plan: StrategicPlanInput | StrategicPlan): StrategicPlan =>
  Object.freeze({
    schemaVersion: 2,
    requestId: plan.requestId,
    playerIntents: plan.playerIntents,
    npcIntents: plan.npcIntents,
    narrative: plan.narrative,
    warnings: plan.warnings,
  });

export const parseStrategicPlan = (value: unknown): StrategicPlan =>
  strategicPlanCore(StrategicPlanInputSchema.parse(value));

const corePlanFromWire = (wire: WireStrategicPlan): StrategicPlan =>
  parseStrategicPlan({
    schemaVersion: wire.schemaVersion,
    requestId: wire.requestId,
    playerIntents: wire.playerIntents.map(normalizeWireIntent),
    npcIntents: wire.npcIntents.map(normalizeWireIntent),
    narrative: wire.narrative,
    warnings: wire.warnings,
  });

export const parseProviderStrategicPlan = (value: unknown): StrategicPlan => {
  const wire = WireStrategicPlanSchema.parse(value);
  const plan = corePlanFromWire(wire);
  return Object.freeze({ ...plan, presentation: parseTurnPresentation(wire.presentation) });
};
