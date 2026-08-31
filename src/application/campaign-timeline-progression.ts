import { TimelineProgressionResultSchema } from "./campaign-progression";
import type { CampaignState } from "./campaign-state";
import type { CampaignWorldEvent } from "./campaign-world-event";
import {
  authorCampaignEventReactions,
  type CampaignReactionAuthor,
} from "./campaign-world-feedback";
import {
  simulateTimelineProgression,
  type TimelineProgression,
  type TimelineStepClock,
} from "./timeline-progression";

export interface AdvanceCampaignTimelineProgressionInput {
  readonly state: CampaignState;
  readonly progression: TimelineProgression;
  readonly reactionAuthor: CampaignReactionAuthor;
}

const nextMajorBoundary = (elapsedDays: number): number =>
  (Math.floor(elapsedDays / 365) + 1) * 365;

const affectedNationIds = (state: CampaignState): readonly string[] =>
  Object.freeze([
    state.playerNationId,
    ...state.nations
      .filter((nation) => nation.id !== state.playerNationId)
      .slice(0, 2)
      .map((nation) => nation.id),
  ]);

const majorEventGenerator = (
  state: CampaignState,
): ((clock: TimelineStepClock) => CampaignWorldEvent | null) => {
  const boundary = nextMajorBoundary(state.elapsedDays);
  let emitted = false;
  return (clock) => {
    if (emitted || clock.elapsedDays < boundary) {
      return null;
    }
    emitted = true;
    const nationIds = affectedNationIds(state);
    return Object.freeze({
      id: `evt_timeline_${boundary}`,
      kind: "political",
      importance: "major",
      occurredAtElapsedDays: clock.elapsedDays,
      turn: state.turn,
      date: Object.freeze({ ...clock.date }),
      actorNationIds: Object.freeze([state.playerNationId]),
      affectedNationIds: nationIds,
      headlineKo: "세계 공급망 위기, 동아시아 공동 대응 촉구",
      summaryKo: `${nationIds.length}개국이 세계적 공급망 충격에 대한 대응에 착수했다.`,
    });
  };
};

export const advanceCampaignTimelineProgression = async (
  input: AdvanceCampaignTimelineProgressionInput,
): Promise<CampaignState> => {
  const simulation = simulateTimelineProgression(
    {
      elapsedDays: input.state.elapsedDays,
      date: input.state.date,
    },
    input.progression,
    majorEventGenerator(input.state),
  );
  const reactions = [];
  for (const event of simulation.events) {
    reactions.push(
      ...(await authorCampaignEventReactions({
        state: input.state,
        event,
        reactionAuthor: input.reactionAuthor,
      })),
    );
  }
  const lastProgression = TimelineProgressionResultSchema.parse({
    mode: simulation.mode,
    advanceDays: simulation.advanceDays,
    steps: simulation.steps,
    stopReason: simulation.stopReason,
    ...(simulation.majorEventId === undefined ? {} : { majorEventId: simulation.majorEventId }),
  });
  return Object.freeze({
    ...input.state,
    elapsedDays: simulation.elapsedDays,
    date: Object.freeze({ ...simulation.date }),
    lastProgression,
    worldEvents: Object.freeze([...input.state.worldEvents, ...simulation.events]),
    nationReactions: Object.freeze([...input.state.nationReactions, ...reactions]),
    events: Object.freeze([
      ...input.state.events,
      ...simulation.events.map((event) => `세계 사건: ${event.headlineKo}`),
      `시간 진행: ${simulation.mode} · ${simulation.advanceDays}일`,
    ]),
  });
};
