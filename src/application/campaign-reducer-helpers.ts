import { parseNationId } from "../shared/ids";
import type { CampaignState } from "./campaign-state";

export const nationName = (state: CampaignState, nationId: string): string =>
  state.nations.find((nation) => nation.id === nationId)?.nameKo ?? nationId;

export const updateNation = (
  state: CampaignState,
  nationId: string,
  update: (nation: CampaignState["nations"][number]) => CampaignState["nations"][number],
): CampaignState => {
  if (!state.nations.some((nation) => nation.id === nationId)) {
    throw new RangeError("NATION_NOT_FOUND");
  }
  return Object.freeze({
    ...state,
    nations: Object.freeze(
      state.nations.map((nation) =>
        nation.id === nationId ? Object.freeze(update(nation)) : nation,
      ),
    ),
  });
};

export const adjustRelation = (
  state: CampaignState,
  fromNationId: string,
  toNationId: string,
  delta: number,
): CampaignState => {
  if (
    fromNationId === toNationId ||
    !state.nations.some((nation) => nation.id === fromNationId) ||
    !state.nations.some((nation) => nation.id === toNationId)
  ) {
    throw new RangeError("RELATION_INVALID");
  }
  const existing = state.relations.find(
    (relation) => relation.fromNationId === fromNationId && relation.toNationId === toNationId,
  );
  const value = Math.max(-10_000, Math.min(10_000, (existing?.value ?? 0) + delta));
  return Object.freeze({
    ...state,
    relations: Object.freeze(
      existing === undefined
        ? [
            ...state.relations,
            Object.freeze({
              fromNationId: parseNationId(fromNationId),
              toNationId: parseNationId(toNationId),
              value,
            }),
          ]
        : state.relations.map((relation) =>
            relation === existing ? Object.freeze({ ...relation, value }) : relation,
          ),
    ),
  });
};

export const appendEvent = (state: CampaignState, event: string): CampaignState =>
  Object.freeze({ ...state, events: Object.freeze([...state.events, event]) });
