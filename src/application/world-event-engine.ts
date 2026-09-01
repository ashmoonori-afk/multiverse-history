import type { CampaignResolution } from "./campaign-resolution";
import type { CampaignState } from "./campaign-state";
import type { CampaignWorldEvent } from "./campaign-world-event";

export interface CampaignWorldEventFactoryInput {
  readonly before: CampaignState;
  readonly reduced: CampaignState;
  readonly resolution: CampaignResolution;
}

export type CampaignWorldEventFactory = (input: CampaignWorldEventFactoryInput) => unknown;

const eventKind = (input: CampaignWorldEventFactoryInput): CampaignWorldEvent["kind"] => {
  if (input.resolution.treatyDeltas.length > 0 || input.resolution.relationDeltas.length > 0) {
    return "diplomatic";
  }
  const previousUnitIds = new Set(input.before.units.map((unit) => unit.id));
  if (input.reduced.units.some((unit) => !previousUnitIds.has(unit.id))) {
    return "military";
  }
  if (
    input.reduced.constructionProjects.length > input.before.constructionProjects.length ||
    input.resolution.nationDeltas.length > 0
  ) {
    return "economic";
  }
  return "political";
};

const headlineForEvent = (
  input: CampaignWorldEventFactoryInput,
  kind: CampaignWorldEvent["kind"],
): string => {
  const actorName =
    input.reduced.nations.find((nation) => nation.id === input.reduced.playerNationId)?.nameKo ??
    "플레이어 국가";
  const affectedNames = input.resolution.worldImpact.changedNationIds
    .filter((nationId) => nationId !== input.reduced.playerNationId)
    .slice(0, 2)
    .map(
      (nationId) =>
        input.reduced.nations.find((nation) => nation.id === nationId)?.nameKo ?? nationId,
    );
  const affectedText = affectedNames.length > 0 ? ` ${affectedNames.join("·")} ` : " 주변국 ";
  switch (kind) {
    case "economic":
      return `${actorName}의 경제 정책,${affectedText}파장 확산`;
    case "diplomatic":
      return `${actorName}의 외교 행보에${affectedText}촉각`;
    case "military":
      return `${actorName}의 군사 움직임,${affectedText}긴장 고조`;
    case "political":
      return `${actorName}의 정치적 결정,${affectedText}반응 주목`;
  }
};

export const createCampaignWorldEvent = (
  input: CampaignWorldEventFactoryInput,
): CampaignWorldEvent => {
  const kind = eventKind(input);
  const affectedNationIds =
    input.resolution.worldImpact.changedNationIds.length === 0
      ? Object.freeze([input.reduced.playerNationId])
      : Object.freeze([...input.resolution.worldImpact.changedNationIds]);
  return Object.freeze({
    id: `evt_${input.resolution.turn}_${input.reduced.worldEvents.length + 1}`,
    kind,
    importance: "minor",
    occurredAtElapsedDays: input.reduced.elapsedDays,
    turn: input.resolution.turn,
    date: Object.freeze({ ...input.reduced.date }),
    actorNationIds: Object.freeze([input.reduced.playerNationId]),
    affectedNationIds,
    headlineKo: headlineForEvent(input, kind),
    summaryKo: input.resolution.worldImpact.summaryKo,
    sourceResolutionId: input.resolution.id,
  });
};
