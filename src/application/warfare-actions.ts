import {
  acceptTreaty,
  assertWarDeclarationLegal,
  proposeTreaty,
  relationAfterWarDeclaration,
  type Treaty,
  type TreatyClause,
} from "../domain/diplomacy/treaties";
import { provinceNameKo } from "../shared/display-labels";
import type { NationId } from "../shared/ids";
import { parseNationId } from "../shared/ids";
import type { CampaignState } from "./campaign-state";

const treatyAsDomain = (treaty: CampaignState["treaties"][number]): Treaty => ({
  id: treaty.id,
  proposerNationId: parseNationId(treaty.proposerNationId),
  participantNationIds: Object.freeze([
    parseNationId(treaty.proposerNationId),
    parseNationId(treaty.recipientNationId),
  ]),
  clauses: treaty.clauses as readonly TreatyClause[],
  status: treaty.status,
  proposedTurn: treaty.proposedTurn,
});

const requireNation = (state: CampaignState, nationId: string): NationId => {
  const parsed = parseNationId(nationId);
  if (!state.nations.some((nation) => nation.id === parsed)) {
    throw new RangeError("NATION_NOT_FOUND");
  }
  return parsed;
};

const requireProvince = (state: CampaignState, provinceId: string) => {
  const province = state.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new RangeError("PROVINCE_NOT_FOUND");
  }
  return province;
};

export const transferCampaignProvince = (
  state: CampaignState,
  targetNationId: string,
  provinceId: string,
): CampaignState => {
  const target = requireNation(state, targetNationId);
  const province = requireProvince(state, provinceId);
  if (province.ownerNationId !== state.playerNationId) {
    throw new RangeError("PROVINCE_TRANSFER_NOT_OWNED");
  }
  return Object.freeze({
    ...state,
    provinces: Object.freeze(
      state.provinces.map((candidate) =>
        candidate.id === provinceId
          ? Object.freeze({ ...candidate, ownerNationId: target })
          : candidate,
      ),
    ),
    events: Object.freeze([
      ...state.events,
      `${nationName(state, state.playerNationId)}가 ${nationName(state, target)}에 ${provinceId} 지역을 이전했다.`,
    ]),
  });
};

const nationName = (state: CampaignState, nationId: string): string =>
  state.nations.find((nation) => nation.id === nationId)?.nameKo ?? nationId;

const clauseName = (clause: TreatyClause): string => {
  switch (clause) {
    case "alliance":
      return "동맹";
    case "non_aggression":
      return "불가침";
    case "military_access":
      return "군사 통행";
    case "trade":
      return "통상";
  }
};

export const proposeCampaignTreaty = (
  state: CampaignState,
  recipientNationId: string,
  clause: TreatyClause,
): CampaignState => {
  const recipient = requireNation(state, recipientNationId);
  const treatyId = `try_${state.turn}_${state.treaties.length}`;
  const proposed = proposeTreaty({
    id: treatyId,
    proposerNationId: parseNationId(state.playerNationId),
    recipientNationId: recipient,
    clauses: [clause],
    turn: state.turn + 1,
  });
  const active = acceptTreaty({
    treaty: proposed,
    actorNationId: recipient,
    turn: state.turn + 1,
  });
  return Object.freeze({
    ...state,
    treaties: Object.freeze([
      ...state.treaties,
      Object.freeze({
        id: active.id,
        proposerNationId: active.proposerNationId,
        recipientNationId: active.participantNationIds[1],
        clauses: Object.freeze([...active.clauses]),
        status: active.status === "active" ? ("active" as const) : ("proposed" as const),
        proposedTurn: active.proposedTurn,
      }),
    ]),
    events: Object.freeze([
      ...state.events,
      `${nationName(state, state.playerNationId)}은 ${nationName(state, recipientNationId)}과 ${clauseName(clause)} 협정을 체결했다.`,
    ]),
  });
};

export const declareCampaignWar = (state: CampaignState, targetNationId: string): CampaignState => {
  const target = requireNation(state, targetNationId);
  const actor = parseNationId(state.playerNationId);
  assertWarDeclarationLegal(actor, target, state.treaties.map(treatyAsDomain));
  const relations = Object.freeze(
    state.relations.map((relation) =>
      relation.fromNationId === actor && relation.toNationId === target
        ? Object.freeze({ ...relation, value: relationAfterWarDeclaration(relation.value) })
        : relation,
    ),
  );
  return Object.freeze({
    ...state,
    relations,
    wars: Object.freeze([
      ...state.wars,
      Object.freeze({
        attackerNationId: actor,
        targetNationId: target,
        declaredTurn: state.turn,
      }),
    ]),
    events: Object.freeze([
      ...state.events,
      `${nationName(state, actor)}은 ${nationName(state, target)}에 전쟁을 선포했다.`,
    ]),
  });
};

export const recruitCampaignUnit = (state: CampaignState, provinceId: string): CampaignState => {
  const province = requireProvince(state, provinceId);
  const actor = parseNationId(state.playerNationId);
  if (province.ownerNationId !== actor) {
    throw new RangeError("RECRUIT_PROVINCE_NOT_CONTROLLED");
  }
  const unitId = `unt_manual_${state.turn}_${state.units.length}`;
  return Object.freeze({
    ...state,
    units: Object.freeze([
      ...state.units,
      Object.freeze({
        id: unitId,
        ownerNationId: actor,
        provinceId,
        manpower: 5_000,
      }),
    ]),
    events: Object.freeze([
      ...state.events,
      `${nationName(state, actor)}은 ${provinceNameKo(provinceId)}에서 5000명을 모집했다.`,
    ]),
  });
};

export const moveCampaignUnit = (
  state: CampaignState,
  unitId: string,
  provinceId: string,
): CampaignState => {
  const province = requireProvince(state, provinceId);
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (unit === undefined || unit.ownerNationId !== state.playerNationId) {
    throw new RangeError("UNIT_NOT_FOUND");
  }
  return Object.freeze({
    ...state,
    units: Object.freeze(
      state.units.map((candidate) =>
        candidate.id === unitId
          ? Object.freeze({ ...candidate, provinceId: province.id })
          : candidate,
      ),
    ),
    events: Object.freeze([
      ...state.events,
      `${nationName(state, unit.ownerNationId)}의 병력이 ${provinceNameKo(province.id)}로 이동했다.`,
    ]),
  });
};

export const resolveCampaignCombat = (state: CampaignState): CampaignState => {
  const actor = parseNationId(state.playerNationId);
  const unit = [...state.units].reverse().find((candidate) => candidate.ownerNationId === actor);
  if (unit === undefined) {
    throw new RangeError("COMBAT_UNIT_NOT_FOUND");
  }
  const province = requireProvince(state, unit.provinceId);
  if (province.ownerNationId === actor) {
    throw new RangeError("COMBAT_TARGET_NOT_FOUND");
  }
  const casualties = Math.min(500, Math.max(100, Math.floor(unit.manpower / 10)));
  const report = `${provinceNameKo(province.id)} 전투 승리 · 사상자 ${casualties}명 · ${nationName(state, actor)} 통제`;
  return Object.freeze({
    ...state,
    provinces: Object.freeze(
      state.provinces.map((candidate) =>
        candidate.id === province.id
          ? Object.freeze({ ...candidate, ownerNationId: actor })
          : candidate,
      ),
    ),
    units: Object.freeze(
      state.units.map((candidate) =>
        candidate.id === unit.id
          ? Object.freeze({ ...candidate, manpower: Math.max(0, candidate.manpower - casualties) })
          : candidate,
      ),
    ),
    battleReports: Object.freeze([...state.battleReports, report]),
    events: Object.freeze([...state.events, report]),
  });
};
