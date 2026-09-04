import { ZodError } from "zod";

import type { StrategicPlan } from "../providers/schemas";
import { hashCanonical } from "../shared/canonical-json";

export interface CampaignTurnState {
  readonly turn: number;
  readonly events: readonly string[];
}

export interface CampaignStore {
  read(): CampaignTurnState;
  replace(state: CampaignTurnState): void;
}

export interface ExecuteProviderTurnInput {
  readonly store: CampaignStore;
  readonly requestId: string;
  readonly plan: () => Promise<StrategicPlan>;
  readonly reduce?: (snapshot: CampaignTurnState, plan: StrategicPlan) => CampaignTurnState;
  readonly prepare?: (
    snapshot: CampaignTurnState,
    plan: StrategicPlan,
  ) => Promise<CampaignTurnState> | CampaignTurnState;
}

export type ProviderTurnErrorCode =
  | "provider_empty_output"
  | "provider_malformed_output"
  | "provider_output_too_large"
  | "provider_plan_invalid"
  | "provider_schema_invalid"
  | "provider_request_mismatch"
  | "provider_cancelled"
  | "provider_timeout"
  | "provider_unavailable"
  | "campaign_conflict";

export class ProviderTurnError extends Error {
  constructor(
    readonly status: 409 | 422 | 503,
    readonly code: ProviderTurnErrorCode,
  ) {
    super(code);
    this.name = "ProviderTurnError";
  }
}

export interface ProviderTurnResult {
  readonly plan: StrategicPlan;
  readonly state: CampaignTurnState;
  readonly stateHash: string;
}

const mappedProviderError = (error: unknown, planSemantics = false): ProviderTurnError => {
  if (error instanceof ProviderTurnError) {
    return error;
  }
  if (planSemantics && error instanceof RangeError) {
    return new ProviderTurnError(422, "provider_plan_invalid");
  }
  const message = error instanceof Error ? error.message : "";
  switch (message) {
    case "PROVIDER_EMPTY_OUTPUT":
      return new ProviderTurnError(422, "provider_empty_output");
    case "PROVIDER_MALFORMED_OUTPUT":
      return new ProviderTurnError(422, "provider_malformed_output");
    case "PROVIDER_OUTPUT_TOO_LARGE":
      return new ProviderTurnError(422, "provider_output_too_large");
    case "PROVIDER_CANCELLED":
      return new ProviderTurnError(503, "provider_cancelled");
    case "PROVIDER_TIMEOUT":
      return new ProviderTurnError(503, "provider_timeout");
    default:
      if (
        message.startsWith("PROVIDER_SCHEMA_INVALID") ||
        error instanceof TypeError ||
        error instanceof ZodError
      ) {
        return new ProviderTurnError(422, "provider_schema_invalid");
      }
      return new ProviderTurnError(503, "provider_unavailable");
  }
};

export const executeProviderTurn = async (
  input: ExecuteProviderTurnInput,
): Promise<ProviderTurnResult> => {
  const snapshot = input.store.read();
  const snapshotHash = hashCanonical(snapshot);
  let plan: StrategicPlan;
  try {
    plan = await input.plan();
  } catch (error) {
    throw mappedProviderError(error);
  }
  if (plan.requestId !== input.requestId) {
    throw new ProviderTurnError(422, "provider_request_mismatch");
  }
  if (hashCanonical(input.store.read()) !== snapshotHash) {
    throw new ProviderTurnError(409, "campaign_conflict");
  }
  let reduced: CampaignTurnState;
  try {
    reduced =
      input.prepare === undefined
        ? (input.reduce?.(snapshot, plan) ?? snapshot)
        : await input.prepare(snapshot, plan);
  } catch (error: unknown) {
    throw mappedProviderError(error, true);
  }
  if (hashCanonical(input.store.read()) !== snapshotHash) {
    throw new ProviderTurnError(409, "campaign_conflict");
  }
  const hasReducer = input.reduce !== undefined || input.prepare !== undefined;
  const state = Object.freeze({
    ...reduced,
    turn: snapshot.turn + 1,
    events: hasReducer
      ? reduced.events
      : Object.freeze([...snapshot.events, `provider_plan:${input.requestId}`]),
  });
  input.store.replace(state);
  return Object.freeze({ plan, state, stateHash: hashCanonical(state) });
};
