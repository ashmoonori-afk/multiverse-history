import {
  assertWarDeclarationLegal,
  relationAfterWarDeclaration,
  type Treaty,
  type TreatyClause,
} from "../domain/diplomacy/treaties";
import { assertAdjacentMove, type ProvinceNode } from "../domain/military/combat";
import type { StrategicIntent } from "../providers/schemas";
import { parseNationId } from "../shared/ids";
import { adjustRelation, appendEvent, nationName, updateNation } from "./campaign-reducer-helpers";
import type { CampaignState } from "./campaign-state";
import { applyUnitAttack } from "./combat-intent-reducer";
import { applyActionFailure } from "./policy-intent-reducers";

type WarIntent = Extract<
  StrategicIntent,
  { readonly type: "war.declare" | "war.peace" | "unit.move" | "unit.attack" | "unit.disband" }
>;

const provinceNodes = (state: CampaignState): readonly ProvinceNode[] =>
  state.provinces.map((province) => ({
    id: province.id,
    controllerNationId: parseNationId(province.ownerNationId),
    isCapital: province.isCapital ?? false,
    isPort: province.isPort ?? false,
    adjacentProvinceIds: province.adjacentProvinceIds ?? [],
  }));

const requireUnit = (state: CampaignState, unitId: string, playerIntent: boolean) => {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (unit === undefined || (playerIntent && unit.ownerNationId !== state.playerNationId)) {
    throw new RangeError("UNIT_NOT_OWNED");
  }
  return unit;
};

const declareWar = (
  state: CampaignState,
  intent: Extract<WarIntent, { readonly type: "war.declare" }>,
  turn: number,
): CampaignState => {
  const actor = parseNationId(intent.actorNationId);
  const target = parseNationId(intent.targetNationId);
  const treaties: readonly Treaty[] = state.treaties.map((treaty) => ({
    id: treaty.id,
    proposerNationId: parseNationId(treaty.proposerNationId),
    participantNationIds: [
      parseNationId(treaty.proposerNationId),
      parseNationId(treaty.recipientNationId),
    ],
    clauses: treaty.clauses as readonly TreatyClause[],
    status: treaty.status,
    proposedTurn: treaty.proposedTurn,
  }));
  const actorExists = state.nations.some((nation) => nation.id === actor);
  const targetExists = state.nations.some((nation) => nation.id === target);
  if (!(actorExists && targetExists)) {
    throw new RangeError("WAR_NATION_NOT_FOUND");
  }
  assertWarDeclarationLegal(actor, target, treaties);
  if (
    state.wars.some(
      (war) =>
        war.status === "active" &&
        [war.attackerNationId, war.targetNationId].includes(actor) &&
        [war.attackerNationId, war.targetNationId].includes(target),
    )
  ) {
    throw new RangeError("WAR_ALREADY_ACTIVE");
  }
  const withWar = Object.freeze({
    ...state,
    wars: Object.freeze([
      ...state.wars,
      Object.freeze({
        id: `war_${turn}_${state.wars.length}`,
        attackerNationId: actor,
        targetNationId: target,
        status: "active" as const,
        declaredTurn: turn,
      }),
    ]),
  });
  const relations = adjustRelation(
    adjustRelation(withWar, actor, target, relationAfterWarDeclaration(0)),
    target,
    actor,
    relationAfterWarDeclaration(0),
  );
  return appendEvent(
    relations,
    `${nationName(state, actor)}이 ${nationName(state, target)}에 선전포고했다: ${intent.casusBelliKo}`,
  );
};

const makePeace = (
  state: CampaignState,
  intent: Extract<WarIntent, { readonly type: "war.peace" }>,
  turn: number,
): CampaignState => {
  const war = state.wars.find((candidate) => candidate.id === intent.warId);
  if (war?.status !== "active") throw new RangeError("ACTIVE_WAR_NOT_FOUND");
  const parties = [war.attackerNationId, war.targetNationId];
  if (new Set(intent.terms.map((term) => term.provinceId)).size !== intent.terms.length) {
    throw new RangeError("PEACE_TERM_INVALID");
  }
  for (const term of intent.terms) {
    const province = state.provinces.find((candidate) => candidate.id === term.provinceId);
    if (
      province?.ownerNationId !== term.fromNationId ||
      term.fromNationId === term.toNationId ||
      !parties.includes(term.fromNationId) ||
      !parties.includes(term.toNationId)
    ) {
      throw new RangeError("PEACE_TERM_INVALID");
    }
  }
  const reparations = intent.reparationsCredits ?? 0;
  const payer = state.nations.find((nation) => nation.id === war.targetNationId);
  if (payer === undefined || payer.treasuryCredits < reparations) {
    throw new RangeError("PEACE_REPARATIONS_INVALID");
  }
  let next = Object.freeze({
    ...state,
    wars: Object.freeze(
      state.wars.map((candidate) =>
        candidate.id === war.id
          ? Object.freeze({ ...candidate, status: "ended" as const, endedTurn: turn })
          : candidate,
      ),
    ),
    provinces: Object.freeze(
      state.provinces.map((province) => {
        const term = intent.terms.find((candidate) => candidate.provinceId === province.id);
        return term === undefined
          ? province
          : Object.freeze({ ...province, ownerNationId: parseNationId(term.toNationId) });
      }),
    ),
  });
  if (reparations > 0) {
    next = updateNation(next, war.targetNationId, (nation) => ({
      ...nation,
      treasuryCredits: nation.treasuryCredits - reparations,
    }));
    next = updateNation(next, war.attackerNationId, (nation) => ({
      ...nation,
      treasuryCredits: nation.treasuryCredits + reparations,
    }));
  }
  return appendEvent(
    next,
    `${nationName(state, war.attackerNationId)}과 ${nationName(state, war.targetNationId)}이 강화했다.`,
  );
};

const moveUnit = (
  state: CampaignState,
  intent: Extract<WarIntent, { readonly type: "unit.move" }>,
  playerIntent: boolean,
): CampaignState => {
  const unit = requireUnit(state, intent.unitId, playerIntent);
  if (!state.provinces.some((province) => province.id === intent.toProvinceId)) {
    throw new RangeError("PROVINCE_NOT_FOUND");
  }
  try {
    assertAdjacentMove(unit.provinceId, intent.toProvinceId, provinceNodes(state));
  } catch (error: unknown) {
    if (error instanceof RangeError && error.message === "DESTINATION_NOT_ADJACENT") {
      return applyActionFailure(state, unit.ownerNationId, "비인접 지역 이동", -100);
    }
    throw error;
  }
  return appendEvent(
    Object.freeze({
      ...state,
      units: Object.freeze(
        state.units.map((candidate) =>
          candidate.id === unit.id
            ? Object.freeze({ ...candidate, provinceId: intent.toProvinceId })
            : candidate,
        ),
      ),
    }),
    `${nationName(state, unit.ownerNationId)} 부대가 이동했다.`,
  );
};

export const applyWarIntent = (
  state: CampaignState,
  intent: WarIntent,
  turn: number,
  playerIntent: boolean,
): CampaignState => {
  switch (intent.type) {
    case "war.declare":
      return declareWar(state, intent, turn);
    case "war.peace":
      return makePeace(state, intent, turn);
    case "unit.move":
      return moveUnit(state, intent, playerIntent);
    case "unit.attack":
      return applyUnitAttack(state, intent, turn, playerIntent);
    case "unit.disband": {
      const unit = requireUnit(state, intent.unitId, playerIntent);
      return appendEvent(
        Object.freeze({
          ...state,
          units: Object.freeze(state.units.filter((candidate) => candidate.id !== unit.id)),
        }),
        `${nationName(state, unit.ownerNationId)} 부대가 해산했다.`,
      );
    }
  }
};
