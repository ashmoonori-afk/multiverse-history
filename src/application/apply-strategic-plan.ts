import { renderChronicle } from "../domain/events/chronicle";
import type { StrategicIntent, StrategicPlan } from "../providers/schemas";
import { provinceNameKo } from "../shared/display-labels";
import type { CampaignState } from "./campaign-state";

const updateNation = (
  state: CampaignState,
  nationId: string,
  update: (nation: CampaignState["nations"][number]) => CampaignState["nations"][number],
): CampaignState["nations"] =>
  Object.freeze(
    state.nations.map((nation) =>
      nation.id === nationId ? Object.freeze(update(nation)) : nation,
    ),
  );

const invest = (
  state: CampaignState,
  intent: Extract<StrategicIntent, { readonly type: "economy.invest" }>,
  turn: number,
): CampaignState => {
  const actor = state.nations.find((nation) => nation.id === intent.actorNationId);
  if (actor === undefined || actor.treasuryCredits < intent.budgetCredits) {
    throw new RangeError("INTENT_ECONOMY_INVALID");
  }
  const infrastructureGainBps = Math.min(500, intent.budgetCredits * 10);
  const chronicle = renderChronicle({
    type: "economy",
    turn,
    actorNameKo: actor.nameKo,
    investmentCredits: intent.budgetCredits,
    infrastructureGainBps,
  });
  return {
    ...state,
    nations: updateNation(state, actor.id, (nation) => ({
      ...nation,
      treasuryCredits: nation.treasuryCredits - intent.budgetCredits,
      infrastructureBps: Math.min(10_000, nation.infrastructureBps + infrastructureGainBps),
    })),
    events: Object.freeze([...state.events, chronicle.textKo]),
  };
};

const proposeTrade = (
  state: CampaignState,
  intent: Extract<StrategicIntent, { readonly type: "diplomacy.propose_treaty" }>,
  turn: number,
  sequence: number,
): CampaignState => {
  const proposer = state.nations.find((nation) => nation.id === intent.actorNationId);
  const recipient = state.nations.find((nation) => nation.id === intent.recipientNationId);
  if (proposer === undefined || recipient === undefined || proposer.id === recipient.id) {
    throw new RangeError("INTENT_TREATY_INVALID");
  }
  const treaty = Object.freeze({
    id: `try_${turn}_${sequence}`,
    proposerNationId: proposer.id,
    recipientNationId: recipient.id,
    clauses: Object.freeze([...intent.clauses]),
    status: "proposed" as const,
    proposedTurn: turn,
  });
  const chronicle = renderChronicle({
    type: "treaty",
    turn,
    proposerNameKo: proposer.nameKo,
    recipientNameKo: recipient.nameKo,
    clauseNameKo: "통상",
    status: "proposed",
  });
  return {
    ...state,
    treaties: Object.freeze([...state.treaties, treaty]),
    events: Object.freeze([...state.events, chronicle.textKo]),
  };
};

const recruit = (
  state: CampaignState,
  intent: Extract<StrategicIntent, { readonly type: "military.recruit" }>,
  turn: number,
  sequence: number,
): CampaignState => {
  const actor = state.nations.find((nation) => nation.id === intent.actorNationId);
  const province = state.provinces.find((candidate) => candidate.id === intent.provinceId);
  if (actor === undefined || province?.ownerNationId !== intent.actorNationId) {
    throw new RangeError("INTENT_RECRUIT_INVALID");
  }
  return {
    ...state,
    units: Object.freeze([
      ...state.units,
      Object.freeze({
        id: `unt_${turn}_${sequence}`,
        ownerNationId: intent.actorNationId,
        provinceId: intent.provinceId,
        manpower: intent.manpower,
      }),
    ]),
    events: Object.freeze([
      ...state.events,
      `${actor.nameKo}은 ${provinceNameKo(intent.provinceId)}에서 ${intent.manpower}명을 모집했다.`,
    ]),
  };
};

const applyIntent = (
  state: CampaignState,
  intent: StrategicIntent,
  turn: number,
  sequence: number,
): CampaignState => {
  switch (intent.type) {
    case "economy.invest":
      return invest(state, intent, turn);
    case "diplomacy.propose_treaty":
      return proposeTrade(state, intent, turn, sequence);
    case "military.recruit":
      return recruit(state, intent, turn, sequence);
  }
};

const nextDate = (date: CampaignState["date"]): CampaignState["date"] =>
  date.quarter === 4
    ? Object.freeze({ year: date.year + 1, quarter: 1 })
    : Object.freeze({ year: date.year, quarter: date.quarter + 1 });

export const applyStrategicPlan = (snapshot: CampaignState, plan: StrategicPlan): CampaignState => {
  const intents = [...plan.playerIntents, ...plan.npcIntents];
  const resolved = intents.reduce(
    (state, intent, index) => applyIntent(state, intent, snapshot.turn + 1, index),
    snapshot,
  );
  return Object.freeze({
    ...resolved,
    elapsedDays: snapshot.elapsedDays + 91,
    date: nextDate(snapshot.date),
    events: Object.freeze([...resolved.events, plan.narrative.ko]),
    lastPlan: plan,
  });
};
