import { renderChronicle } from "../domain/events/chronicle";
import type { StrategicIntent, StrategicPlan } from "../providers/schemas";
import { provinceNameKo } from "../shared/display-labels";
import { appendIncomingCampaignChat } from "./campaign-chat";
import { createCampaignResolution } from "./campaign-resolution";
import { advanceCampaignClock, type CampaignState, type TimelineCadence } from "./campaign-state";

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
  sequence: number,
): CampaignState => {
  const actor = state.nations.find((nation) => nation.id === intent.actorNationId);
  const province = state.provinces.find((candidate) => candidate.id === intent.provinceId);
  if (
    actor === undefined ||
    province?.ownerNationId !== actor.id ||
    actor.treasuryCredits < intent.budgetCredits
  ) {
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
    constructionProjects: Object.freeze([
      ...state.constructionProjects,
      Object.freeze({
        id: `cst_${turn}_${sequence}`,
        ownerNationId: actor.id,
        provinceId: province.id,
        kind: "rail" as const,
        investedCredits: intent.budgetCredits,
        startedTurn: turn,
        status: "active" as const,
      }),
    ]),
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
  const currentRelation = state.relations.find(
    (relation) => relation.fromNationId === proposer.id && relation.toNationId === recipient.id,
  );
  const relationAfter = Math.min(10_000, (currentRelation?.value ?? 0) + 50);
  const relations = Object.freeze(
    currentRelation === undefined
      ? [
          ...state.relations,
          Object.freeze({
            fromNationId: proposer.id,
            toNationId: recipient.id,
            value: relationAfter,
          }),
        ]
      : state.relations.map((relation) =>
          relation.fromNationId === proposer.id && relation.toNationId === recipient.id
            ? Object.freeze({ ...relation, value: relationAfter })
            : relation,
        ),
  );
  return {
    ...state,
    relations,
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
      return invest(state, intent, turn, sequence);
    case "diplomacy.propose_treaty":
      return proposeTrade(state, intent, turn, sequence);
    case "military.recruit":
      return recruit(state, intent, turn, sequence);
  }
};

export interface ApplyStrategicPlanInput {
  readonly snapshot: CampaignState;
  readonly plan: StrategicPlan;
  readonly orderText?: string;
  readonly cadence?: TimelineCadence;
}

export const applyStrategicPlan = (input: ApplyStrategicPlanInput): CampaignState => {
  const snapshot = input.snapshot;
  const plan = input.plan;
  const orderText = input.orderText ?? "플레이어 계획";
  const cadence = input.cadence ?? "quarter";
  const intents = [...plan.playerIntents, ...plan.npcIntents];
  const resolved = intents.reduce(
    (state, intent, index) => applyIntent(state, intent, snapshot.turn + 1, index),
    snapshot,
  );
  const clock = advanceCampaignClock({
    elapsedDays: snapshot.elapsedDays,
    date: snapshot.date,
    cadence,
  });
  const nextState = Object.freeze({
    ...resolved,
    elapsedDays: clock.elapsedDays,
    date: clock.date,
    events: Object.freeze([...resolved.events, plan.narrative.ko]),
    lastPlan: plan,
  });
  const resolution = createCampaignResolution({
    before: snapshot,
    after: nextState,
    turn: snapshot.turn + 1,
    cadence,
    advanceDays: clock.advanceDays,
    orderText: orderText.trim(),
    narrativeKo: plan.narrative.ko,
    changedProvinceIds: intents.flatMap((intent) =>
      "provinceId" in intent ? [intent.provinceId] : [],
    ),
  });
  const committed = Object.freeze({
    ...nextState,
    resolutions: Object.freeze([...snapshot.resolutions, resolution]),
  });
  const incomingNationId = resolution.treatyDeltas[0]?.recipientNationId;
  if (incomingNationId === undefined) {
    return committed;
  }
  const incomingNationName =
    committed.nations.find((nation) => nation.id === incomingNationId)?.nameKo ?? incomingNationId;
  return appendIncomingCampaignChat({
    state: committed,
    speakerNationId: incomingNationId,
    turn: resolution.turn,
    message: `${incomingNationName} 외교부는 귀국의 통상 협정 제안을 공식 접수했습니다. 관세와 철도 연결 조건을 논의할 실무 회담을 요청합니다. 협상 대표단의 답신을 기다리겠습니다.`,
    topic: "trade",
    intent: "proposal",
    sourceKey: `diplomacy:trade:${committed.playerNationId}:${incomingNationId}`,
  });
};
