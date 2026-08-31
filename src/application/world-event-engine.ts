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

const headlineByKind: Readonly<Record<CampaignWorldEvent["kind"], string>> = Object.freeze({
  economic: "새 경제 정책이 역내 질서에 파장",
  diplomatic: "외교 협정 제안에 주변국 대응",
  military: "군사 동향 변화에 각국 촉각",
  political: "새 국가 방침 발표와 국제 반응",
});

export const createCampaignWorldEvent = (
  input: CampaignWorldEventFactoryInput,
): CampaignWorldEvent => {
  const affectedNationIds =
    input.resolution.worldImpact.changedNationIds.length === 0
      ? Object.freeze([input.reduced.playerNationId])
      : Object.freeze([...input.resolution.worldImpact.changedNationIds]);
  return Object.freeze({
    id: `evt_${input.resolution.turn}_${input.reduced.worldEvents.length + 1}`,
    kind: eventKind(input),
    importance: "minor",
    occurredAtElapsedDays: input.reduced.elapsedDays,
    turn: input.resolution.turn,
    date: Object.freeze({ ...input.reduced.date }),
    actorNationIds: Object.freeze([input.reduced.playerNationId]),
    affectedNationIds,
    headlineKo: headlineByKind[eventKind(input)],
    summaryKo: input.resolution.worldImpact.summaryKo,
    sourceResolutionId: input.resolution.id,
  });
};
