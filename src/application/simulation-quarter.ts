import { calculateTradeIncome, resolveQuarterEconomy } from "../domain/economy/resolve-quarter";
import type { CampaignNationDelta, CampaignNumericDelta } from "./campaign-resolution";
import { type CampaignUnitDelta, campaignUnitDelta } from "./campaign-resolution-entities";
import type { CampaignState } from "./campaign-state";
import { applySupplyAttrition } from "./simulation-supply";

export interface SimulationQuarterResult {
  readonly state: CampaignState;
  readonly nationDeltas: readonly CampaignNationDelta[];
  readonly unitDeltas: readonly CampaignUnitDelta[];
  readonly events: readonly string[];
}

interface InsolvencyResult {
  readonly state: CampaignState;
  readonly upkeepCredits: number;
  readonly deltas: readonly CampaignUnitDelta[];
  readonly insolvent: boolean;
}

const compareId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const upkeep = (manpower: number): number => Math.ceil(manpower / 1_000);
const numeric = (before: number, after: number): CampaignNumericDelta =>
  Object.freeze({ before, after, source: "tick" });

const nationDelta = (
  before: CampaignState["nations"][number],
  after: CampaignState["nations"][number],
): CampaignNationDelta =>
  Object.freeze({
    nationId: after.id,
    nationNameKo: after.nameKo,
    treasuryCredits: numeric(before.treasuryCredits, after.treasuryCredits),
    gdpCredits: numeric(before.gdpCredits, after.gdpCredits),
    infrastructureBps: numeric(before.infrastructureBps, after.infrastructureBps),
    ...(before.stabilityBps === after.stabilityBps
      ? {}
      : { stabilityBps: numeric(before.stabilityBps, after.stabilityBps) }),
    ...(before.population === after.population
      ? {}
      : { population: numeric(before.population, after.population) }),
  });

const tradeIncome = (state: CampaignState, nationId: string): number =>
  state.treaties
    .filter(
      (treaty) =>
        treaty.status === "active" &&
        treaty.clauses.includes("trade") &&
        [treaty.proposerNationId, treaty.recipientNationId].includes(nationId),
    )
    .reduce((sum, treaty) => {
      const otherId =
        treaty.proposerNationId === nationId ? treaty.recipientNationId : treaty.proposerNationId;
      const nation = state.nations.find((candidate) => candidate.id === nationId);
      const other = state.nations.find((candidate) => candidate.id === otherId);
      if (nation === undefined || other === undefined) return sum;
      const total = calculateTradeIncome(nation.gdpCredits, other.gdpCredits, 1_000);
      return sum + (nationId < otherId ? Math.ceil(total / 2) : Math.floor(total / 2));
    }, 0);

const disbandForUpkeep = (
  state: CampaignState,
  nationId: string,
  availableCredits: number,
): InsolvencyResult => {
  const units = state.units
    .filter((unit) => unit.ownerNationId === nationId)
    .sort((a, b) => upkeep(b.manpower) - upkeep(a.manpower) || compareId(a.id, b.id));
  let upkeepCredits = units.reduce((sum, unit) => sum + upkeep(unit.manpower), 0);
  const removed: CampaignUnitDelta[] = [];
  for (const unit of units) {
    if (upkeepCredits <= availableCredits) break;
    upkeepCredits -= upkeep(unit.manpower);
    removed.push(campaignUnitDelta(unit, undefined, "tick"));
  }
  const removedIds = new Set(removed.map((delta) => delta.unitId));
  return Object.freeze({
    state:
      removed.length === 0
        ? state
        : Object.freeze({
            ...state,
            units: Object.freeze(state.units.filter((unit) => !removedIds.has(unit.id))),
          }),
    upkeepCredits,
    deltas: Object.freeze(removed),
    insolvent: removed.length > 0,
  });
};

const stabilityAfter = (
  before: number,
  treasuryCredits: number,
  inWar: boolean,
  insolvent: boolean,
): number => {
  const afterInsolvency = before - (insolvent ? 300 : 0);
  const penalty = (inWar ? 150 : 0) + (treasuryCredits === 0 ? 200 : 0);
  const drifted =
    penalty > 0
      ? afterInsolvency - penalty
      : afterInsolvency === 5_000
        ? 5_000
        : afterInsolvency + (afterInsolvency < 5_000 ? 50 : -50);
  return Math.max(0, Math.min(10_000, drifted));
};

const advanceNation = (state: CampaignState, nationId: string): SimulationQuarterResult => {
  const before = state.nations.find((nation) => nation.id === nationId);
  if (before === undefined) {
    return Object.freeze({ state, nationDeltas: [], unitDeltas: [], events: [] });
  }
  const income = tradeIncome(state, nationId);
  const taxRevenue = Math.floor((before.gdpCredits * before.taxRateBps) / 10_000);
  const insolvency = disbandForUpkeep(
    state,
    nationId,
    before.treasuryCredits + taxRevenue + income,
  );
  const economy = resolveQuarterEconomy({
    treasuryCredits: before.treasuryCredits,
    gdpCredits: before.gdpCredits,
    taxRateBps: before.taxRateBps,
    unitUpkeepCredits: insolvency.upkeepCredits,
    tradeIncomeCredits: income,
    railInvestmentCredits: 0,
    infrastructureBps: before.infrastructureBps,
    population: before.population,
    annualGrowthBps: state.date.year < 1_800 ? 30 : state.date.year < 1_950 ? 80 : 120,
  });
  const inWar = state.wars.some(
    (war) =>
      war.status === "active" && [war.attackerNationId, war.targetNationId].includes(nationId),
  );
  const after = Object.freeze({
    ...before,
    treasuryCredits: economy.treasuryCredits,
    gdpCredits: economy.gdpCredits,
    infrastructureBps: economy.infrastructureBps,
    population: economy.population,
    stabilityBps: stabilityAfter(
      before.stabilityBps,
      economy.treasuryCredits,
      inWar,
      insolvency.insolvent,
    ),
  });
  const events = [
    ...(insolvency.insolvent ? [`${nationId} 재정 파탄으로 부대를 해산했다.`] : []),
    ...(after.stabilityBps < 1_500 ? [`${nationId} 정권 붕괴 위험이 커졌다.`] : []),
  ];
  return Object.freeze({
    state: Object.freeze({
      ...insolvency.state,
      nations: Object.freeze(
        insolvency.state.nations.map((nation) => (nation.id === nationId ? after : nation)),
      ),
    }),
    nationDeltas: Object.freeze([nationDelta(before, after)]),
    unitDeltas: insolvency.deltas,
    events: Object.freeze(events),
  });
};

export const runSimulationQuarter = (state: CampaignState): SimulationQuarterResult => {
  const nationDeltas: CampaignNationDelta[] = [];
  const unitDeltas: CampaignUnitDelta[] = [];
  const events: string[] = [];
  let next = state;
  for (const nationId of state.nations.map((nation) => nation.id).sort(compareId)) {
    const result = advanceNation(next, nationId);
    next = result.state;
    nationDeltas.push(...result.nationDeltas);
    unitDeltas.push(...result.unitDeltas);
    events.push(...result.events);
  }
  const supply = applySupplyAttrition(next);
  events.push(...supply.events);
  return Object.freeze({
    state: Object.freeze({
      ...supply.state,
      elapsedDays: supply.state.elapsedDays + 91,
      date: Object.freeze({
        year: supply.state.date.year + (supply.state.date.quarter === 4 ? 1 : 0),
        quarter: supply.state.date.quarter === 4 ? 1 : supply.state.date.quarter + 1,
      }),
      events: Object.freeze([...supply.state.events, ...events]),
    }),
    nationDeltas: Object.freeze(nationDeltas),
    unitDeltas: Object.freeze([...unitDeltas, ...supply.unitDeltas]),
    events: Object.freeze(events),
  });
};
