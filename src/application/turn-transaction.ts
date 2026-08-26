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
}

export type ProviderTurnErrorCode =
  | "provider_empty_output"
  | "provider_malformed_output"
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

const mappedProviderError = (error: unknown): ProviderTurnError => {
  if (error instanceof ProviderTurnError) {
    return error;
  }
  const message = error instanceof Error ? error.message : "";
  switch (message) {
    case "PROVIDER_EMPTY_OUTPUT":
      return new ProviderTurnError(422, "provider_empty_output");
    case "PROVIDER_MALFORMED_OUTPUT":
      return new ProviderTurnError(422, "provider_malformed_output");
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
  const reduced = input.reduce?.(snapshot, plan) ?? snapshot;
  const state = Object.freeze({
    ...reduced,
    turn: snapshot.turn + 1,
    events:
      input.reduce === undefined
        ? Object.freeze([...snapshot.events, `provider_plan:${input.requestId}`])
        : reduced.events,
  });
  input.store.replace(state);
  return Object.freeze({ plan, state, stateHash: hashCanonical(state) });
};
