import type { StrategicPlan } from "./schemas";
import { parseProviderStrategicPlan } from "./schemas";

export interface CodexCommandInput {
  readonly schemaPath: string;
  readonly resultPath: string;
}

export const buildCodexArguments = (input: CodexCommandInput): readonly string[] =>
  Object.freeze([
    "exec",
    "--ephemeral",
    "--ignore-rules",
    "--model",
    "gpt-5.4-mini",
    "-c",
    'model_reasoning_effort="low"',
    "--json",
    "--output-schema",
    input.schemaPath,
    "--output-last-message",
    input.resultPath,
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "-",
  ]);

export const parseCodexLastMessage = (value: string): StrategicPlan => {
  if (value.trim().length === 0) {
    throw new TypeError("PROVIDER_EMPTY_OUTPUT");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new TypeError("PROVIDER_MALFORMED_OUTPUT");
  }
  return parseProviderStrategicPlan(parsed);
};
