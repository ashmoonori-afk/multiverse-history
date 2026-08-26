import { createHash } from "node:crypto";

import { z } from "zod";

import type { NationId } from "../../shared/ids";

export type Terrain = "plains" | "hills" | "mountains" | "forest" | "urban";
export type UnitStatus = "active" | "retreating" | "destroyed";

export interface ProvinceNode {
  readonly id: string;
  readonly controllerNationId: NationId;
  readonly isCapital: boolean;
  readonly isPort: boolean;
  readonly adjacentProvinceIds: readonly string[];
}

export interface UnitState {
  readonly id: string;
  readonly ownerNationId: NationId;
  readonly currentProvinceId: string;
  readonly manpower: number;
  readonly equipmentBps: number;
  readonly readinessBps: number;
  readonly supplyBps: number;
  readonly status: UnitStatus;
}

export interface SupplyInput {
  readonly ownerNationId: NationId;
  readonly unitProvinceId: string;
  readonly provinces: readonly ProvinceNode[];
  readonly militaryAccessNationIds: readonly NationId[];
}

export interface CombatInput {
  readonly campaignSeed: string;
  readonly turn: number;
  readonly attacker: UnitState;
  readonly defenders: readonly UnitState[];
  readonly terrain: Terrain;
}

export interface CombatResult {
  readonly attackerWon: boolean;
  readonly attackerCasualties: number;
  readonly defenderCasualties: number;
  readonly attackerRemaining: number;
  readonly defenderRemaining: number;
}

const NonNegativeIntegerSchema = z.number().safe().int().min(0);
const BasisPointsSchema = NonNegativeIntegerSchema.max(10_000);

const terrainModifierBps: Readonly<Record<Terrain, number>> = Object.freeze({
  plains: 10_000,
  hills: 11_000,
  mountains: 12_500,
  forest: 11_500,
  urban: 12_000,
});

const provinceMap = (provinces: readonly ProvinceNode[]): ReadonlyMap<string, ProvinceNode> => {
  const map = new Map(provinces.map((province) => [province.id, province]));
  if (map.size !== provinces.length) {
    throw new RangeError("Province IDs must be unique");
  }
  return map;
};

const isTraversable = (province: ProvinceNode, input: SupplyInput): boolean =>
  province.controllerNationId === input.ownerNationId ||
  input.militaryAccessNationIds.includes(province.controllerNationId);

interface SupplySearchState {
  readonly input: SupplyInput;
  readonly provinces: ReadonlyMap<string, ProvinceNode>;
  readonly queue: { readonly provinceId: string; readonly distance: number }[];
  readonly visited: Set<string>;
}

const requireProvince = (
  provinces: ReadonlyMap<string, ProvinceNode>,
  provinceId: string,
): ProvinceNode => {
  const province = provinces.get(provinceId);
  if (province === undefined) {
    throw new RangeError(`Missing province: ${provinceId}`);
  }
  return province;
};

const appendSupplyNeighbors = (
  state: SupplySearchState,
  province: ProvinceNode,
  distance: number,
): void => {
  for (const neighborId of [...province.adjacentProvinceIds].sort()) {
    const neighbor = state.provinces.get(neighborId);
    if (
      neighbor !== undefined &&
      !state.visited.has(neighborId) &&
      isTraversable(neighbor, state.input)
    ) {
      state.visited.add(neighborId);
      state.queue.push({ provinceId: neighborId, distance });
    }
  }
};

const findSupplyDistance = (
  input: SupplyInput,
  provinces: ReadonlyMap<string, ProvinceNode>,
  start: ProvinceNode,
): number | undefined => {
  const state: SupplySearchState = {
    input,
    provinces,
    queue: [{ provinceId: start.id, distance: 0 }],
    visited: new Set([start.id]),
  };
  while (state.queue.length > 0) {
    const current = state.queue.shift();
    if (current === undefined) {
      return undefined;
    }
    const province = requireProvince(provinces, current.provinceId);
    if (province.isCapital || province.isPort) {
      return current.distance;
    }
    if (current.distance < 6) {
      appendSupplyNeighbors(state, province, current.distance + 1);
    }
  }
  return undefined;
};

export const calculateSupplyBps = (input: SupplyInput): number => {
  const provinces = provinceMap(input.provinces);
  const start = provinces.get(input.unitProvinceId);
  if (start === undefined || !isTraversable(start, input)) {
    return 2_500;
  }
  const distance = findSupplyDistance(input, provinces, start);
  return distance === undefined ? 2_500 : Math.max(4_000, 10_000 - 750 * distance);
};

export const assertAdjacentMove = (
  originProvinceId: string,
  destinationProvinceId: string,
  provinces: readonly ProvinceNode[],
): void => {
  const origin = provinceMap(provinces).get(originProvinceId);
  if (origin === undefined || !origin.adjacentProvinceIds.includes(destinationProvinceId)) {
    throw new RangeError("DESTINATION_NOT_ADJACENT");
  }
};

const validateUnit = (unit: UnitState): void => {
  NonNegativeIntegerSchema.parse(unit.manpower);
  BasisPointsSchema.parse(unit.equipmentBps);
  BasisPointsSchema.parse(unit.readinessBps);
  BasisPointsSchema.parse(unit.supplyBps);
};

const seededVariationBps = (seedMaterial: string): number => {
  const digest = createHash("sha256").update(seedMaterial).digest();
  return 9_500 + (digest.readUInt16BE(0) % 1_001);
};

const calculateScore = (unit: UnitState, terrainBps: number, seedMaterial: string): number => {
  const base = Math.floor((unit.manpower * unit.equipmentBps) / 10_000);
  const prepared = Math.floor((base * unit.readinessBps) / 10_000);
  const supplied = Math.floor((prepared * unit.supplyBps) / 10_000);
  const adjusted = Math.floor((supplied * terrainBps) / 10_000);
  return Math.floor((adjusted * seededVariationBps(seedMaterial)) / 10_000);
};

export const resolveCombat = (input: CombatInput): CombatResult => {
  NonNegativeIntegerSchema.parse(input.turn);
  validateUnit(input.attacker);
  if (input.defenders.length === 0) {
    throw new RangeError("Combat requires at least one defender");
  }
  input.defenders.forEach(validateUnit);
  const defenderIds = input.defenders
    .map((defender) => defender.id)
    .sort()
    .join(",");
  const attackerScore = calculateScore(
    input.attacker,
    10_000,
    `${input.campaignSeed}|${input.turn}|${input.attacker.id}|${defenderIds}`,
  );
  const defenderScore = input.defenders.reduce(
    (total, defender) =>
      total +
      calculateScore(
        defender,
        terrainModifierBps[input.terrain],
        `${input.campaignSeed}|${input.turn}|${defender.id}|${input.attacker.id}`,
      ),
    0,
  );
  const defenderManpower = input.defenders.reduce(
    (total, defender) => total + defender.manpower,
    0,
  );
  const attackerWon = attackerScore * 10_000 >= defenderScore * 11_000;
  const loserCasualties = Math.min(
    attackerWon ? defenderManpower : input.attacker.manpower,
    Math.max(
      1,
      Math.floor(
        ((attackerWon ? attackerScore : defenderScore) * 800) /
          Math.max(1, attackerWon ? defenderScore : attackerScore),
      ),
    ),
  );
  const winnerCasualties = Math.min(
    attackerWon ? input.attacker.manpower : defenderManpower,
    Math.max(1, Math.floor((loserCasualties * 350) / 1_000)),
  );
  const attackerCasualties = attackerWon ? winnerCasualties : loserCasualties;
  const defenderCasualties = attackerWon ? loserCasualties : winnerCasualties;
  return Object.freeze({
    attackerWon,
    attackerCasualties,
    defenderCasualties,
    attackerRemaining: input.attacker.manpower - attackerCasualties,
    defenderRemaining: defenderManpower - defenderCasualties,
  });
};
