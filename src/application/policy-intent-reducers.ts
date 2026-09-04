import { acceptTreaty, type Treaty, type TreatyClause } from "../domain/diplomacy/treaties";
import type { StrategicIntent } from "../providers/schemas";
import { parseNationId } from "../shared/ids";
import { adjustRelation, appendEvent, nationName, updateNation } from "./campaign-reducer-helpers";
import type { CampaignState } from "./campaign-state";

type PolicyIntent = Extract<
  StrategicIntent,
  {
    readonly type:
      | "nation.adjust"
      | "relation.adjust"
      | "treaty.respond"
      | "treaty.terminate"
      | "polity.change"
      | "action.fail";
  }
>;

const limitedDelta = (current: number, requested: number | undefined): number => {
  if (requested === undefined || requested === 0) return 0;
  const limit = Math.max(1, Math.floor(Math.abs(current) / 5));
  return Math.max(-limit, Math.min(limit, requested));
};

export const applyActionFailure = (
  state: CampaignState,
  actorNationId: string,
  attemptKo: string,
  stabilityDelta: number,
): CampaignState =>
  appendEvent(
    updateNation(state, actorNationId, (nation) => ({
      ...nation,
      stabilityBps: Math.max(0, Math.min(10_000, nation.stabilityBps + stabilityDelta)),
    })),
    `${nationName(state, actorNationId)}의 시도 실패: ${attemptKo}`,
  );

const adjustNation = (
  state: CampaignState,
  intent: Extract<PolicyIntent, { readonly type: "nation.adjust" }>,
): CampaignState => {
  if (
    intent.nationId === state.playerNationId &&
    ((intent.treasuryDelta ?? 0) < 0 || (intent.stabilityDelta ?? 0) < 0)
  ) {
    throw new RangeError("PLAYER_SOVEREIGNTY_VIOLATION");
  }
  const next = updateNation(state, intent.nationId, (nation) => ({
    ...nation,
    treasuryCredits: Math.max(
      0,
      nation.treasuryCredits + limitedDelta(nation.treasuryCredits, intent.treasuryDelta),
    ),
    gdpCredits: Math.max(0, nation.gdpCredits + limitedDelta(nation.gdpCredits, intent.gdpDelta)),
    stabilityBps: Math.max(
      0,
      Math.min(
        10_000,
        nation.stabilityBps + limitedDelta(nation.stabilityBps, intent.stabilityDelta),
      ),
    ),
    ...(intent.taxRateBps === undefined ? {} : { taxRateBps: intent.taxRateBps }),
  }));
  return appendEvent(next, `${nationName(state, intent.nationId)} 정책 조정: ${intent.reasonKo}`);
};

const treatyAsDomain = (state: CampaignState, treatyId: string): Treaty => {
  const treaty = state.treaties.find((candidate) => candidate.id === treatyId);
  if (treaty === undefined) throw new RangeError("TREATY_NOT_FOUND");
  return {
    id: treaty.id,
    proposerNationId: parseNationId(treaty.proposerNationId),
    participantNationIds: [
      parseNationId(treaty.proposerNationId),
      parseNationId(treaty.recipientNationId),
    ],
    clauses: treaty.clauses as readonly TreatyClause[],
    status: treaty.status,
    proposedTurn: treaty.proposedTurn,
    ...(treaty.resolvedTurn === undefined ? {} : { activatedTurn: treaty.resolvedTurn }),
  };
};

const respondTreaty = (
  state: CampaignState,
  intent: Extract<PolicyIntent, { readonly type: "treaty.respond" }>,
  turn: number,
): CampaignState => {
  const treaty = treatyAsDomain(state, intent.treatyId);
  if (treaty.status !== "proposed" || intent.actorNationId !== treaty.participantNationIds[1]) {
    throw new RangeError("TREATY_RESPONSE_INVALID");
  }
  if (intent.decision === "accept") {
    acceptTreaty({ treaty, actorNationId: parseNationId(intent.actorNationId), turn });
  }
  const status = intent.decision === "accept" ? "active" : "rejected";
  return appendEvent(
    Object.freeze({
      ...state,
      treaties: Object.freeze(
        state.treaties.map((candidate) =>
          candidate.id === intent.treatyId
            ? Object.freeze({ ...candidate, status, resolvedTurn: turn })
            : candidate,
        ),
      ),
    }),
    `${nationName(state, intent.actorNationId)}이 협정을 ${status === "active" ? "수락" : "거절"}했다.`,
  );
};

const terminateTreaty = (
  state: CampaignState,
  intent: Extract<PolicyIntent, { readonly type: "treaty.terminate" }>,
  turn: number,
): CampaignState => {
  const treaty = state.treaties.find((candidate) => candidate.id === intent.treatyId);
  if (
    treaty === undefined ||
    treaty.status !== "active" ||
    ![treaty.proposerNationId, treaty.recipientNationId].includes(intent.actorNationId)
  ) {
    throw new RangeError("TREATY_TERMINATION_INVALID");
  }
  const counterpart =
    treaty.proposerNationId === intent.actorNationId
      ? treaty.recipientNationId
      : treaty.proposerNationId;
  const terminated = Object.freeze({
    ...state,
    treaties: Object.freeze(
      state.treaties.map((candidate) =>
        candidate.id === treaty.id
          ? Object.freeze({ ...candidate, status: "terminated" as const, terminatedTurn: turn })
          : candidate,
      ),
    ),
  });
  return appendEvent(
    adjustRelation(terminated, intent.actorNationId, counterpart, -1_500),
    `${nationName(state, intent.actorNationId)}이 협정을 종료했다: ${intent.reasonKo}`,
  );
};

const changePolity = (
  state: CampaignState,
  intent: Extract<PolicyIntent, { readonly type: "polity.change" }>,
): CampaignState => {
  if (
    intent.capitalProvinceId !== undefined &&
    !state.provinces.some(
      (province) =>
        province.id === intent.capitalProvinceId && province.ownerNationId === intent.nationId,
    )
  ) {
    throw new RangeError("CAPITAL_NOT_OWNED");
  }
  return appendEvent(
    updateNation(state, intent.nationId, (nation) => ({
      ...nation,
      ...(intent.nameKo === undefined ? {} : { nameKo: intent.nameKo }),
      ...(intent.governmentKo === undefined ? {} : { governmentKo: intent.governmentKo }),
      ...(intent.capitalProvinceId === undefined
        ? {}
        : { capitalProvinceId: intent.capitalProvinceId }),
    })),
    `${nationName(state, intent.nationId)}의 국체가 변경되었다.`,
  );
};

export const applyPolicyIntent = (
  state: CampaignState,
  intent: PolicyIntent,
  turn: number,
): CampaignState => {
  switch (intent.type) {
    case "nation.adjust":
      return adjustNation(state, intent);
    case "relation.adjust":
      return appendEvent(
        adjustRelation(state, intent.fromNationId, intent.toNationId, intent.delta),
        intent.reasonKo,
      );
    case "treaty.respond":
      return respondTreaty(state, intent, turn);
    case "treaty.terminate":
      return terminateTreaty(state, intent, turn);
    case "polity.change":
      return changePolity(state, intent);
    case "action.fail":
      return applyActionFailure(
        state,
        intent.actorNationId,
        intent.attemptKo,
        intent.stabilityDelta,
      );
  }
};
