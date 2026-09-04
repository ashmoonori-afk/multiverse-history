import { renderChronicle } from "../domain/events/chronicle";
import { type StrategicIntent, type StrategicPlan, strategicPlanCore } from "../providers/schemas";
import { provinceNameKo } from "../shared/display-labels";
import { appendIncomingCampaignChat } from "./campaign-chat";
import { type CampaignDeclaredTransfer, createCampaignResolution } from "./campaign-resolution";
import { advanceCampaignClock, type CampaignState, type TimelineCadence } from "./campaign-state";
import { applyPolicyIntent } from "./policy-intent-reducers";
import { applyWarIntent } from "./war-intent-reducers";

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

const voluntaryActorNationIds = (intent: StrategicIntent): readonly string[] => {
  switch (intent.type) {
    case "nation.adjust":
      return [];
    case "relation.adjust":
      return [intent.fromNationId];
    case "polity.change":
      return [intent.nationId];
    default:
      return [intent.actorNationId];
  }
};

const assertIntentActor = (
  intent: StrategicIntent,
  playerNationId: string,
  playerIntent: boolean,
): void => {
  if (intent.type === "territory.transfer") {
    if (
      (intent.actorNationId === playerNationId) !== playerIntent ||
      (playerIntent
        ? intent.fromNationId !== playerNationId && intent.toNationId !== playerNationId
        : intent.fromNationId !== intent.actorNationId)
    ) {
      throw new RangeError("INTENT_ACTOR_INVALID");
    }
    return;
  }
  const actorNationIds = voluntaryActorNationIds(intent);
  const laneActorNationId = actorNationIds[0];
  if (
    laneActorNationId !== undefined &&
    ((laneActorNationId === playerNationId) !== playerIntent ||
      actorNationIds.some((actorNationId) => actorNationId !== laneActorNationId))
  ) {
    throw new RangeError("INTENT_ACTOR_INVALID");
  }
};

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
        kind: intent.sector,
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
    clauseNameKo: intent.clauses.includes("port_access") ? "조건부 입항" : "통상",
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

/**
 * Territory only changes hands through an explicit, self-describing record:
 * the stated previous owner must be the real one, so narration can never quietly
 * repaint the map.
 */
const transferTerritory = (
  state: CampaignState,
  intent: Extract<StrategicIntent, { readonly type: "territory.transfer" }>,
  turn: number,
): CampaignState => {
  const province = state.provinces.find((candidate) => candidate.id === intent.provinceId);
  const from = state.nations.find((nation) => nation.id === intent.fromNationId);
  const to = state.nations.find((nation) => nation.id === intent.toNationId);
  if (
    province === undefined ||
    from === undefined ||
    to === undefined ||
    from.id === to.id ||
    province.ownerNationId !== from.id
  ) {
    throw new RangeError("INTENT_TERRITORY_INVALID");
  }
  return {
    ...state,
    provinces: Object.freeze(
      state.provinces.map((candidate) =>
        candidate.id === province.id
          ? Object.freeze({ ...candidate, ownerNationId: to.id })
          : candidate,
      ),
    ),
    events: Object.freeze([
      ...state.events,
      `${turn}턴: ${provinceNameKo(province.id)}의 지배권이 ${from.nameKo}에서 ${to.nameKo}(으)로 넘어갔다. (${intent.reasonKo})`,
    ]),
  };
};

const applyIntent = (
  state: CampaignState,
  intent: StrategicIntent,
  turn: number,
  sequence: number,
  playerIntent: boolean,
): CampaignState => {
  switch (intent.type) {
    case "economy.invest":
      return invest(state, intent, turn, sequence);
    case "diplomacy.propose_treaty":
      return proposeTrade(state, intent, turn, sequence);
    case "military.recruit":
      return recruit(state, intent, turn, sequence);
    case "territory.transfer":
      return transferTerritory(state, intent, turn);
    case "nation.adjust":
    case "relation.adjust":
    case "treaty.respond":
    case "treaty.terminate":
    case "polity.change":
    case "action.fail":
      return applyPolicyIntent(state, intent, turn, playerIntent);
    case "war.declare":
    case "war.peace":
    case "unit.move":
    case "unit.attack":
    case "unit.disband":
      return applyWarIntent(state, intent, turn);
  }
};

const declaredTransfersOf = (plan: StrategicPlan): readonly CampaignDeclaredTransfer[] =>
  Object.freeze([
    ...plan.playerIntents.flatMap((intent) =>
      intent.type === "territory.transfer"
        ? [
            Object.freeze({
              provinceId: intent.provinceId,
              reasonKo: intent.reasonKo,
              cause: "player" as const,
            }),
          ]
        : intent.type === "war.peace"
          ? intent.terms.map((term) =>
              Object.freeze({
                provinceId: term.provinceId,
                reasonKo: term.reasonKo,
                cause: "player" as const,
              }),
            )
          : [],
    ),
    ...plan.npcIntents.flatMap((intent) =>
      intent.type === "territory.transfer"
        ? [
            Object.freeze({
              provinceId: intent.provinceId,
              reasonKo: intent.reasonKo,
              cause: "npc" as const,
            }),
          ]
        : intent.type === "war.peace"
          ? intent.terms.map((term) =>
              Object.freeze({
                provinceId: term.provinceId,
                reasonKo: term.reasonKo,
                cause: "npc" as const,
              }),
            )
          : [],
    ),
  ]);

export interface ApplyStrategicPlanInput {
  readonly snapshot: CampaignState;
  readonly plan: StrategicPlan;
  readonly orderText?: string;
  readonly cadence?: TimelineCadence;
}

export const applyStrategicPlan = (input: ApplyStrategicPlanInput): CampaignState => {
  const snapshot = input.snapshot;
  const plan = input.plan;
  for (const intent of plan.playerIntents) {
    assertIntentActor(intent, snapshot.playerNationId, true);
  }
  for (const intent of plan.npcIntents) {
    assertIntentActor(intent, snapshot.playerNationId, false);
  }
  const orderText = input.orderText ?? "플레이어 계획";
  const cadence = input.cadence ?? "quarter";
  const playerResolved = plan.playerIntents.reduce(
    (state, intent, index) => applyIntent(state, intent, snapshot.turn + 1, index, true),
    snapshot,
  );
  const resolved = plan.npcIntents.reduce(
    (state, intent, index) =>
      applyIntent(state, intent, snapshot.turn + 1, plan.playerIntents.length + index, false),
    playerResolved,
  );
  const intents = [...plan.playerIntents, ...plan.npcIntents];
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
    lastPlan: strategicPlanCore(plan),
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
      "provinceId" in intent && intent.provinceId !== undefined ? [intent.provinceId] : [],
    ),
    declaredTransfers: declaredTransfersOf(plan),
  });
  const committed = Object.freeze({
    ...nextState,
    resolutions: Object.freeze([...snapshot.resolutions, resolution]),
  });
  const incomingTreaty = resolution.treatyDeltas[0];
  if (
    incomingTreaty === undefined ||
    ![incomingTreaty.proposerNationId, incomingTreaty.recipientNationId].includes(
      committed.playerNationId,
    )
  ) {
    return committed;
  }
  const playerProposed = incomingTreaty.proposerNationId === committed.playerNationId;
  const incomingNationId = playerProposed
    ? incomingTreaty.recipientNationId
    : incomingTreaty.proposerNationId;
  const incomingNationName =
    committed.nations.find((nation) => nation.id === incomingNationId)?.nameKo ?? incomingNationId;
  return appendIncomingCampaignChat({
    state: committed,
    speakerNationId: incomingNationId,
    turn: resolution.turn,
    message: playerProposed
      ? `${incomingNationName} 외교부는 귀국의 조건부 협정 제안을 공식 접수했습니다. 특구 입항과 지원 조항에 관한 실무 회담을 요청합니다. 협상 대표단의 답신을 기다리겠습니다.`
      : `${incomingNationName} 외교부가 귀국에 조건부 협정 제안을 전달했습니다. 특구 입항과 지원 조항에 관한 실무 회담을 요청합니다.`,
    topic: "trade",
    intent: "proposal",
    sourceKey: `diplomacy:trade:${incomingTreaty.proposerNationId}:${incomingTreaty.recipientNationId}`,
  });
};
