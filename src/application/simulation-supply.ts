import { calculateSupplyBps, type ProvinceNode } from "../domain/military/combat";
import { parseNationId } from "../shared/ids";
import { type CampaignUnitDelta, campaignUnitDelta } from "./campaign-resolution-entities";
import type { CampaignState } from "./campaign-state";

export interface SupplyAttritionResult {
  readonly state: CampaignState;
  readonly unitDeltas: readonly CampaignUnitDelta[];
  readonly events: readonly string[];
}

const nodes = (state: CampaignState): readonly ProvinceNode[] =>
  state.provinces.map((province) => ({
    id: province.id,
    controllerNationId: parseNationId(province.ownerNationId),
    isCapital: province.isCapital ?? false,
    isPort: province.isPort ?? false,
    adjacentProvinceIds: province.adjacentProvinceIds ?? [],
  }));

const accessNationIds = (state: CampaignState, ownerNationId: string) =>
  state.treaties.flatMap((treaty) => {
    if (
      treaty.status !== "active" ||
      !treaty.clauses.includes("military_access") ||
      ![treaty.proposerNationId, treaty.recipientNationId].includes(ownerNationId)
    ) {
      return [];
    }
    return [
      parseNationId(
        treaty.proposerNationId === ownerNationId
          ? treaty.recipientNationId
          : treaty.proposerNationId,
      ),
    ];
  });

export const applySupplyAttrition = (state: CampaignState): SupplyAttritionResult => {
  const unitDeltas: CampaignUnitDelta[] = [];
  const events: string[] = [];
  let next = state;
  for (const unit of [...state.units].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const province = state.provinces.find((candidate) => candidate.id === unit.provinceId);
    if (province === undefined || province.ownerNationId === unit.ownerNationId) continue;
    const supplyBps = calculateSupplyBps({
      ownerNationId: parseNationId(unit.ownerNationId),
      unitProvinceId: unit.provinceId,
      provinces: nodes(state),
      militaryAccessNationIds: accessNationIds(state, unit.ownerNationId),
    });
    if (supplyBps >= 5_000) continue;
    const manpower = Math.floor(unit.manpower * 0.95);
    const after = Object.freeze({ ...unit, manpower });
    unitDeltas.push(campaignUnitDelta(unit, manpower === 0 ? undefined : after, "tick"));
    next = Object.freeze({
      ...next,
      units: Object.freeze(
        next.units.flatMap((candidate) =>
          candidate.id !== unit.id ? [candidate] : manpower === 0 ? [] : [after],
        ),
      ),
    });
    events.push(`${unit.ownerNationId} 보급 부족으로 병력이 감소했다.`);
  }
  return Object.freeze({
    state: next,
    unitDeltas: Object.freeze(unitDeltas),
    events: Object.freeze(events),
  });
};
