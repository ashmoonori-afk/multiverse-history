import { z } from "zod";

import type { StrategicPlan } from "./schemas";
import { parseProviderStrategicPlan } from "./schemas";

const ClaudeEnvelopeSchema = z
  .object({
    type: z.literal("result"),
    subtype: z.literal("success"),
    result: z.unknown().optional(),
    structured_output: z.unknown().optional(),
  })
  .passthrough();

export const buildClaudeArguments = (schemaJson: string): readonly string[] =>
  Object.freeze([
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    schemaJson,
    "--permission-mode",
    "plan",
    "--tools",
    "",
    "--no-session-persistence",
  ]);

const decodeResult = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  if (value.trim().length === 0) {
    throw new TypeError("PROVIDER_EMPTY_OUTPUT");
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new TypeError("PROVIDER_MALFORMED_OUTPUT");
  }
};

export const parseClaudeEnvelope = (value: string): StrategicPlan => {
  if (value.trim().length === 0) {
    throw new TypeError("PROVIDER_EMPTY_OUTPUT");
  }
  let decodedEnvelope: unknown;
  try {
    decodedEnvelope = JSON.parse(value);
  } catch {
    throw new TypeError("PROVIDER_MALFORMED_OUTPUT");
  }
  const envelope = ClaudeEnvelopeSchema.parse(decodedEnvelope);
  const result = envelope.structured_output ?? envelope.result;
  if (result === undefined) {
    throw new TypeError("PROVIDER_EMPTY_OUTPUT");
  }
  return parseProviderStrategicPlan(decodeResult(result));
};
