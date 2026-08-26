import { z } from "zod";

const NationIdSchema = z
  .string()
  .regex(/^nat_[a-z0-9_]+$/)
  .brand<"NationId">();
const ScenarioIdSchema = z
  .string()
  .regex(/^scn_[a-z0-9_]+$/)
  .brand<"ScenarioId">();
const SafeIntegerSchema = z.number().safe().int();
const BasisPointsSchema = SafeIntegerSchema.min(0).max(10_000);

export type NationId = z.infer<typeof NationIdSchema>;
export type ScenarioId = z.infer<typeof ScenarioIdSchema>;

export const parseNationId = (value: string): NationId => NationIdSchema.parse(value);
export const parseScenarioId = (value: string): ScenarioId => ScenarioIdSchema.parse(value);
export const parseSafeInteger = (value: number): number => SafeIntegerSchema.parse(value);
export const parseBasisPoints = (value: number): number => BasisPointsSchema.parse(value);
