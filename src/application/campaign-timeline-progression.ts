import type { StrategicPlan } from "../providers/schemas";
import { hashCanonical } from "../shared/canonical-json";
import { applyStrategicPlan } from "./apply-strategic-plan";
import { campaignNewsArticleBody, createCampaignNewsArticle } from "./campaign-news-article";
import { TimelineProgressionResultSchema } from "./campaign-progression";
import { type CampaignResolution, createCampaignResolution } from "./campaign-resolution";
import type { CampaignState, TimelineCadence } from "./campaign-state";
import type { CampaignWorldEvent } from "./campaign-world-event";
import { CampaignWorldEventSchema } from "./campaign-world-event";
import { applyEventImpacts, type EventImpact, EventImpactSchema } from "./event-impact";
import { runSimulationTicks } from "./simulation-tick";
import type { TimelineProgression } from "./timeline-progression";
import type { CampaignWorldEventFactory } from "./world-event-engine";

export type AdvanceHorizon =
  | { readonly mode: "days"; readonly days: number }
  | { readonly mode: "until_major_event" };

export interface AdvanceCampaignTimelineProgressionInput {
  readonly state: CampaignState;
  readonly plan: StrategicPlan;
  readonly orderText: string;
  readonly horizon: AdvanceHorizon;
  readonly cadence: TimelineCadence;
  readonly eventFactory: CampaignWorldEventFactory;
  readonly progression?: TimelineProgression;
  readonly dateQuarterSteps?: number;
  readonly promoteGeneratedEvent?: boolean;
}

export interface AdvanceCampaignTimelineProgressionResult {
  readonly state: CampaignState;
  readonly events: readonly CampaignWorldEvent[];
}

const DAYS_PER_QUARTER = 91;
const MAX_UNTIL_EVENT_DAYS = 548;
const MAX_UNTIL_EVENT_STEPS = 24;

const nextMajorBoundary = (elapsedDays: number): number =>
  (Math.floor(elapsedDays / 365) + 1) * 365;

const quarterBoundaryCount = (elapsedDays: number): number =>
  Math.floor((elapsedDays + 1) / DAYS_PER_QUARTER);

const completedQuarters = (elapsedDays: number, advanceDays: number): number =>
  quarterBoundaryCount(elapsedDays + advanceDays) - quarterBoundaryCount(elapsedDays);

const advanceDate = (date: CampaignState["date"], quarterSteps: number): CampaignState["date"] => {
  const quarterIndex = date.quarter - 1 + quarterSteps;
  return Object.freeze({
    year: date.year + Math.floor(quarterIndex / 4),
    quarter: (quarterIndex % 4) + 1,
  });
};

const withClock = (
  state: CampaignState,
  before: CampaignState,
  advanceDays: number,
  quarterSteps: number,
): CampaignState =>
  Object.freeze({
    ...state,
    elapsedDays: before.elapsedDays + advanceDays,
    date: advanceDate(before.date, quarterSteps),
  });

const parseGeneratedEvents = (value: unknown): readonly CampaignWorldEvent[] => {
  if (value === null || value === undefined) return Object.freeze([]);
  const values = Array.isArray(value) ? value : [value];
  return Object.freeze(
    values
      .map((event, sourceIndex) => ({
        event: CampaignWorldEventSchema.parse(event),
        sourceIndex,
      }))
      .sort(
        (left, right) =>
          left.event.occurredAtElapsedDays - right.event.occurredAtElapsedDays ||
          left.sourceIndex - right.sourceIndex,
      )
      .map(({ event }) => event),
  );
};

const attachResolutionOwnership = (
  events: readonly CampaignWorldEvent[],
  resolution: CampaignResolution,
): readonly CampaignWorldEvent[] => {
  const resolutionEventIndex = events.findIndex(
    (event) => event.sourceResolutionId === resolution.id,
  );
  const ownershipEventIndex =
    resolutionEventIndex < 0 && events.length === 1 ? 0 : resolutionEventIndex;
  return Object.freeze(
    events.map((event, index) => {
      if (
        index !== ownershipEventIndex ||
        resolution.worldImpact.regionOwnershipOverrides.length === 0 ||
        (event.impacts?.regionTransfers.length ?? 0) > 0
      ) {
        return event;
      }
      const impacts = EventImpactSchema.parse({
        ...(event.impacts ?? {}),
        regionTransfers: resolution.worldImpact.regionOwnershipOverrides.map((change) => ({
          regionId: change.regionId,
          fromNationId: change.fromNationId,
          toNationId: change.toNationId,
          note: change.reasonKo,
          sourceEventId: event.id,
        })),
      });
      return CampaignWorldEventSchema.parse({
        ...event,
        impacts,
        regionIds: [
          ...new Set([
            ...(event.regionIds ?? []),
            ...impacts.regionTransfers.map((transfer) => transfer.regionId),
          ]),
        ],
      });
    }),
  );
};

const generateEvents = (
  input: AdvanceCampaignTimelineProgressionInput,
  reduced: CampaignState,
  resolution: CampaignResolution,
): readonly CampaignWorldEvent[] => {
  if (input.horizon.mode === "days") {
    return attachResolutionOwnership(
      parseGeneratedEvents(input.eventFactory({ before: input.state, reduced, resolution })),
      resolution,
    );
  }
  if (input.promoteGeneratedEvent === true) {
    const advanceDays = Math.min(
      MAX_UNTIL_EVENT_DAYS,
      nextMajorBoundary(input.state.elapsedDays) - input.state.elapsedDays,
    );
    const eventState = withClock(
      reduced,
      input.state,
      advanceDays,
      completedQuarters(input.state.elapsedDays, advanceDays),
    );
    return attachResolutionOwnership(
      parseGeneratedEvents(
        input.eventFactory({ before: input.state, reduced: eventState, resolution }),
      ),
      resolution,
    );
  }
  const generated: CampaignWorldEvent[] = [];
  for (let step = 1; step <= MAX_UNTIL_EVENT_STEPS; step += 1) {
    const advanceDays = Math.min(MAX_UNTIL_EVENT_DAYS, step * 30);
    const eventState = Object.freeze({
      ...withClock(
        reduced,
        input.state,
        advanceDays,
        completedQuarters(input.state.elapsedDays, advanceDays),
      ),
      worldEvents: Object.freeze([...input.state.worldEvents, ...generated]),
    });
    const events = parseGeneratedEvents(
      input.eventFactory({ before: input.state, reduced: eventState, resolution }),
    );
    generated.push(...events);
    if (
      events.some((event) => event.importance === "major") ||
      advanceDays === MAX_UNTIL_EVENT_DAYS
    ) {
      break;
    }
  }
  return attachResolutionOwnership(parseGeneratedEvents(generated), resolution);
};

const selectHorizon = (
  input: AdvanceCampaignTimelineProgressionInput,
  events: readonly CampaignWorldEvent[],
  requestedDays: number,
): { readonly advanceDays: number; readonly events: readonly CampaignWorldEvent[] } => {
  const maximumDays = input.horizon.mode === "days" ? requestedDays : MAX_UNTIL_EVENT_DAYS;
  const boundedEvents = events.filter(
    (event) =>
      event.occurredAtElapsedDays > input.state.elapsedDays &&
      event.occurredAtElapsedDays <= input.state.elapsedDays + maximumDays,
  );
  if (input.horizon.mode === "days") {
    return Object.freeze({ advanceDays: requestedDays, events: Object.freeze(boundedEvents) });
  }
  let normalizedEvents: readonly CampaignWorldEvent[] = boundedEvents;
  let majorIndex = normalizedEvents.findIndex((event) => event.importance === "major");
  if (majorIndex < 0 && input.promoteGeneratedEvent === true && normalizedEvents.length > 0) {
    const first = normalizedEvents[0];
    if (first !== undefined) {
      normalizedEvents = Object.freeze([
        Object.freeze({ ...first, importance: "major" as const }),
        ...normalizedEvents.slice(1),
      ]);
      majorIndex = 0;
    }
  }
  if (majorIndex < 0) {
    return Object.freeze({ advanceDays: MAX_UNTIL_EVENT_DAYS, events: normalizedEvents });
  }
  const major = normalizedEvents[majorIndex];
  const eventOffset = major?.occurredAtElapsedDays ?? input.state.elapsedDays + requestedDays;
  const advanceDays = Math.max(
    1,
    Math.min(MAX_UNTIL_EVENT_DAYS, eventOffset - input.state.elapsedDays),
  );
  return Object.freeze({
    advanceDays,
    events: Object.freeze(normalizedEvents.slice(0, majorIndex + 1)),
  });
};

const applyEvents = (
  state: CampaignState,
  events: readonly CampaignWorldEvent[],
): { readonly state: CampaignState; readonly events: readonly CampaignWorldEvent[] } => {
  let next = state;
  const normalized: CampaignWorldEvent[] = [];
  for (const event of events) {
    const impact = event.impacts;
    if (impact === undefined) {
      normalized.push(event);
      continue;
    }
    const normalizedImpact: EventImpact = EventImpactSchema.parse({
      ...impact,
      regionTransfers: impact.regionTransfers.map((transfer) => {
        const currentOwner = next.provinces.find(
          (province) => province.id === transfer.regionId,
        )?.ownerNationId;
        const fromNationId =
          currentOwner === transfer.toNationId && transfer.fromNationId !== undefined
            ? transfer.fromNationId
            : (currentOwner ?? transfer.fromNationId);
        return {
          ...transfer,
          ...(fromNationId === undefined ? {} : { fromNationId }),
          sourceEventId: event.id,
        };
      }),
    });
    const normalizedEvent = CampaignWorldEventSchema.parse({
      ...event,
      impacts: normalizedImpact,
      regionIds: [
        ...new Set([
          ...(event.regionIds ?? []),
          ...normalizedImpact.regionTransfers.map((transfer) => transfer.regionId),
        ]),
      ],
    });
    next = applyEventImpacts(next, [normalizedImpact]);
    normalized.push(normalizedEvent);
  }
  return Object.freeze({ state: next, events: Object.freeze(normalized) });
};

const unique = (values: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(values)]);

const mergeResolution = (
  before: CampaignState,
  policyState: CampaignState,
  impactedState: CampaignState,
  tickState: CampaignState,
  policyResolution: CampaignResolution,
  tickDeltas: ReturnType<typeof runSimulationTicks>["deltas"],
  events: readonly CampaignWorldEvent[],
  input: AdvanceCampaignTimelineProgressionInput,
  advanceDays: number,
): CampaignResolution => {
  const impactResolution = createCampaignResolution({
    before: policyState,
    after: impactedState,
    turn: before.turn + 1,
    cadence: input.cadence,
    advanceDays,
    orderText: input.orderText,
    narrativeKo: input.plan.narrative.ko,
    changedProvinceIds: events.flatMap((event) => event.regionIds ?? []),
  });
  const nationDeltas = Object.freeze([
    ...policyResolution.nationDeltas,
    ...impactResolution.nationDeltas,
    ...tickDeltas.nationDeltas,
  ]);
  const relationDeltas = Object.freeze([
    ...policyResolution.relationDeltas,
    ...impactResolution.relationDeltas,
    ...tickDeltas.relationDeltas,
  ]);
  const treatyDeltas = Object.freeze([
    ...policyResolution.treatyDeltas,
    ...impactResolution.treatyDeltas,
    ...tickDeltas.treatyDeltas,
  ]);
  const unitDeltas = Object.freeze([
    ...policyResolution.unitDeltas,
    ...impactResolution.unitDeltas,
    ...tickDeltas.unitDeltas,
  ]);
  const regionOwnershipOverrides = Object.freeze([
    ...policyResolution.worldImpact.regionOwnershipOverrides,
    ...impactResolution.worldImpact.regionOwnershipOverrides,
    ...tickDeltas.regionOwnershipOverrides,
  ]);
  const merged = Object.freeze({
    ...policyResolution,
    timestampKo: `${tickState.date.year}년 ${tickState.date.quarter}분기 · +${advanceDays}일 · 턴 ${before.turn + 1}`,
    cadence: input.cadence,
    advanceDays,
    orderText: input.orderText,
    nationDeltas,
    relationDeltas,
    treatyDeltas,
    unitDeltas,
    worldEventIds: Object.freeze(events.map((event) => event.id)),
    worldImpact: Object.freeze({
      changedNationIds: unique([
        ...policyResolution.worldImpact.changedNationIds,
        ...impactResolution.worldImpact.changedNationIds,
        ...tickDeltas.nationDeltas.map((delta) => delta.nationId),
        ...events.flatMap((event) => event.affectedNationIds),
      ]),
      changedProvinceIds: unique([
        ...policyResolution.worldImpact.changedProvinceIds,
        ...impactResolution.worldImpact.changedProvinceIds,
        ...regionOwnershipOverrides.map((change) => change.regionId),
      ]),
      summaryKo:
        events.length === 0
          ? policyResolution.worldImpact.summaryKo
          : events.map((event) => event.summaryKo).join(" "),
      regionOwnershipOverrides,
    }),
  });
  const article = createCampaignNewsArticle(
    merged,
    new Map(tickState.nations.map((nation) => [nation.id, nation.nameKo])),
  );
  return Object.freeze({ ...merged, article, articleKo: campaignNewsArticleBody(article) });
};

const progressionResult = (
  input: AdvanceCampaignTimelineProgressionInput,
  advanceDays: number,
  events: readonly CampaignWorldEvent[],
) => {
  if (input.progression === undefined && input.horizon.mode === "days") {
    return input.state.lastProgression;
  }
  const progression = input.progression ?? { mode: "until_major_event" as const };
  if (progression.mode === "months") {
    return TimelineProgressionResultSchema.parse({
      mode: progression.mode,
      advanceDays,
      steps: progression.months,
      stopReason: "requested_duration",
    });
  }
  const major = events.find((event) => event.importance === "major");
  return TimelineProgressionResultSchema.parse({
    mode: progression.mode,
    advanceDays,
    steps: Math.ceil(advanceDays / 30),
    stopReason: major === undefined ? "horizon_reached" : "major_event",
    ...(major === undefined ? {} : { majorEventId: major.id }),
  });
};

export const advanceCampaignTimelineProgression = (
  input: AdvanceCampaignTimelineProgressionInput,
): AdvanceCampaignTimelineProgressionResult => {
  const requestedDays = input.horizon.mode === "days" ? input.horizon.days : MAX_UNTIL_EVENT_DAYS;
  const recordOrderText = input.orderText.trim() || "시간 진행";
  const policyApplied = applyStrategicPlan({
    snapshot: input.state,
    plan: input.plan,
    orderText: recordOrderText,
    cadence: input.cadence,
  });
  const provisionalQuarterSteps =
    input.dateQuarterSteps ?? completedQuarters(input.state.elapsedDays, requestedDays);
  const provisional = withClock(policyApplied, input.state, requestedDays, provisionalQuarterSteps);
  const policyResolution = provisional.resolutions.at(-1);
  if (policyResolution === undefined) throw new RangeError("CAMPAIGN_RESOLUTION_MISSING");
  const horizon = selectHorizon(
    input,
    generateEvents(input, provisional, policyResolution),
    requestedDays,
  );
  const quarterSteps =
    input.dateQuarterSteps ?? completedQuarters(input.state.elapsedDays, horizon.advanceDays);
  const policyState = withClock(provisional, input.state, horizon.advanceDays, quarterSteps);
  const appliedEvents = applyEvents(policyState, horizon.events);
  const ticks = runSimulationTicks({
    state: withClock(appliedEvents.state, input.state, 0, 0),
    quarters: completedQuarters(input.state.elapsedDays, horizon.advanceDays),
    seedBase: `${hashCanonical(input.state)}:${input.state.turn}`,
  });
  const finalState = withClock(ticks.state, input.state, horizon.advanceDays, quarterSteps);
  const resolution = mergeResolution(
    input.state,
    policyState,
    appliedEvents.state,
    finalState,
    policyResolution,
    ticks.deltas,
    appliedEvents.events,
    { ...input, orderText: recordOrderText },
    horizon.advanceDays,
  );
  return Object.freeze({
    events: appliedEvents.events,
    state: Object.freeze({
      ...finalState,
      lastProgression: progressionResult(input, horizon.advanceDays, appliedEvents.events),
      worldEvents: Object.freeze([...input.state.worldEvents, ...appliedEvents.events]),
      events: Object.freeze([
        ...ticks.state.events,
        ...appliedEvents.events.map((event) => `세계 사건: ${event.headlineKo}`),
        `시간 진행: ${horizon.advanceDays}일`,
      ]),
      resolutions: Object.freeze([...input.state.resolutions, resolution]),
    }),
  });
};
