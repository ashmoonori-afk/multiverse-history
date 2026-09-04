import type {
  CampaignNationDelta,
  CampaignRegionOwnershipChange,
  CampaignRelationDelta,
  CampaignTreatyDelta,
} from "./campaign-resolution";
import type { CampaignUnitDelta } from "./campaign-resolution-entities";
import type { CampaignState } from "./campaign-state";
import { runSimulationQuarter } from "./simulation-quarter";

export interface RunSimulationTicksInput {
  readonly state: CampaignState;
  readonly quarters: number;
  readonly seedBase: string;
}

export interface SimulationTickDeltas {
  readonly nationDeltas: readonly CampaignNationDelta[];
  readonly relationDeltas: readonly CampaignRelationDelta[];
  readonly treatyDeltas: readonly CampaignTreatyDelta[];
  readonly unitDeltas: readonly CampaignUnitDelta[];
  readonly regionOwnershipOverrides: readonly CampaignRegionOwnershipChange[];
}

export interface SimulationTickResult {
  readonly state: CampaignState;
  readonly deltas: SimulationTickDeltas;
  readonly events: readonly string[];
}

export const runSimulationTicks = (input: RunSimulationTicksInput): SimulationTickResult => {
  if (!Number.isSafeInteger(input.quarters) || input.quarters < 0 || input.quarters > 8) {
    throw new RangeError("INVALID_SIMULATION_QUARTERS");
  }
  if (input.seedBase.length === 0) throw new RangeError("INVALID_SIMULATION_SEED");
  const nationDeltas: CampaignNationDelta[] = [];
  const unitDeltas: CampaignUnitDelta[] = [];
  const events: string[] = [];
  let state = input.state;
  for (let quarter = 0; quarter < input.quarters; quarter += 1) {
    const result = runSimulationQuarter(state);
    state = result.state;
    nationDeltas.push(...result.nationDeltas);
    unitDeltas.push(...result.unitDeltas);
    events.push(...result.events);
  }
  return Object.freeze({
    state,
    deltas: Object.freeze({
      nationDeltas: Object.freeze(nationDeltas),
      relationDeltas: Object.freeze([]),
      treatyDeltas: Object.freeze([]),
      unitDeltas: Object.freeze(unitDeltas),
      regionOwnershipOverrides: Object.freeze([]),
    }),
    events: Object.freeze(events),
  });
};
