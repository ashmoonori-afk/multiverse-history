import {
  assertAdjacentMove,
  type ProvinceNode,
  resolveCombat,
  type Terrain,
  type UnitState,
} from "../domain/military/combat";
import type { StrategicIntent } from "../providers/schemas";
import { hashCanonical } from "../shared/canonical-json";
import { parseNationId } from "../shared/ids";
import type { CampaignState } from "./campaign-state";

const nodes = (state: CampaignState): readonly ProvinceNode[] =>
  state.provinces.map((province) => ({
    id: province.id,
    controllerNationId: parseNationId(province.ownerNationId),
    isCapital: province.isCapital ?? false,
    isPort: province.isPort ?? false,
    adjacentProvinceIds: province.adjacentProvinceIds ?? [],
  }));

const terrain = (value: string | undefined): Terrain => {
  switch (value) {
    case "mountain":
    case "mountains":
      return "mountains";
    case "forest":
      return "forest";
    case "urban":
      return "urban";
    case "hills":
      return "hills";
    default:
      return "plains";
  }
};

const combatUnit = (unit: CampaignState["units"][number]): UnitState => ({
  id: unit.id,
  ownerNationId: parseNationId(unit.ownerNationId),
  currentProvinceId: unit.provinceId,
  manpower: unit.manpower,
  equipmentBps: 10_000,
  readinessBps: 10_000,
  supplyBps: 10_000,
  status: "active",
});

export const applyUnitAttack = (
  state: CampaignState,
  intent: Extract<StrategicIntent, { readonly type: "unit.attack" }>,
  turn: number,
): CampaignState => {
  const attacker = state.units.find((unit) => unit.id === intent.unitId);
  if (attacker === undefined || attacker.ownerNationId !== intent.actorNationId) {
    throw new RangeError("UNIT_NOT_OWNED");
  }
  const target = state.provinces.find((province) => province.id === intent.targetProvinceId);
  if (target === undefined || target.ownerNationId === attacker.ownerNationId) {
    throw new RangeError("COMBAT_TARGET_INVALID");
  }
  assertAdjacentMove(attacker.provinceId, target.id, nodes(state));
  if (
    !state.wars.some(
      (war) =>
        war.status === "active" &&
        [war.attackerNationId, war.targetNationId].includes(attacker.ownerNationId) &&
        [war.attackerNationId, war.targetNationId].includes(target.ownerNationId),
    )
  ) {
    throw new RangeError("COMBAT_WAR_REQUIRED");
  }
  const defenders = state.units
    .filter((unit) => unit.provinceId === target.id && unit.ownerNationId === target.ownerNationId)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (defenders.length === 0) throw new RangeError("COMBAT_DEFENDER_NOT_FOUND");
  const result = resolveCombat({
    campaignSeed: `${hashCanonical(state)}|${turn}|${attacker.id}|${target.id}`,
    turn,
    attacker: combatUnit(attacker),
    defenders: defenders.map(combatUnit),
    terrain: terrain(target.terrain),
  });
  let defenderLoss = result.defenderCasualties;
  const units = state.units.flatMap((unit) => {
    let manpower = unit.manpower;
    let provinceId = unit.provinceId;
    if (unit.id === attacker.id) {
      manpower = result.attackerRemaining;
      if (result.attackerWon) provinceId = target.id;
    } else if (defenders.some((defender) => defender.id === unit.id)) {
      const loss = Math.min(manpower, defenderLoss);
      defenderLoss -= loss;
      manpower -= loss;
    }
    return manpower === 0 ? [] : [Object.freeze({ ...unit, manpower, provinceId })];
  });
  const report = `${target.nameKo ?? target.id} 전투: ${result.attackerWon ? "공격군 승리" : "방어군 승리"}`;
  return Object.freeze({
    ...state,
    units: Object.freeze(units),
    provinces: result.attackerWon
      ? Object.freeze(
          state.provinces.map((province) =>
            province.id === target.id
              ? Object.freeze({ ...province, ownerNationId: parseNationId(attacker.ownerNationId) })
              : province,
          ),
        )
      : state.provinces,
    battleReports: Object.freeze([...state.battleReports, report]),
    events: Object.freeze([...state.events, report]),
  });
};
