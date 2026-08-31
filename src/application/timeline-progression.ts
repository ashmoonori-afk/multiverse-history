import type { TimelineProgressionResult } from "./campaign-progression";
import type { CampaignWorldEvent } from "./campaign-world-event";
import { CampaignWorldEventSchema } from "./campaign-world-event";

const DAYS_PER_MONTH = 30;
const DAYS_PER_QUARTER = 90;
const MAX_MONTHS = 18;
const MAX_UNTIL_EVENT_DAYS = 548;
const MAX_UNTIL_EVENT_STEPS = 24;

export type TimelineProgression =
  | { readonly mode: "months"; readonly months: number }
  | { readonly mode: "until_major_event" };

export type TimelineSnapshotClock = {
  readonly elapsedDays: number;
  readonly date: CampaignWorldEvent["date"];
};

export type TimelineStepClock = TimelineSnapshotClock & {
  readonly step: number;
};

export type TimelineEventGenerator = (clock: TimelineStepClock) => unknown;

export type TimelineProgressionSimulationResult = TimelineProgressionResult & {
  readonly elapsedDays: number;
  readonly date: CampaignWorldEvent["date"];
  readonly events: readonly CampaignWorldEvent[];
};

export type TimelineProgressionErrorCode = "INVALID_MONTHS" | "MALFORMED_GENERATED_EVENT";

export class TimelineProgressionRangeError extends RangeError {
  override readonly name = "TimelineProgressionRangeError";

  constructor(
    readonly code: TimelineProgressionErrorCode,
    readonly step?: number,
  ) {
    super(code);
  }
}

const assertNever = (value: never): never => {
  throw new TypeError(`UNSUPPORTED_TIMELINE_PROGRESSION:${String(value)}`);
};

const dateAfterDays = (
  date: TimelineSnapshotClock["date"],
  advanceDays: number,
): TimelineSnapshotClock["date"] => {
  const quarterSteps = Math.floor(advanceDays / DAYS_PER_QUARTER);
  const quarterIndex = date.quarter - 1 + quarterSteps;
  return Object.freeze({
    year: date.year + Math.floor(quarterIndex / 4),
    quarter: (quarterIndex % 4) + 1,
  });
};

export const simulateTimelineProgression = (
  snapshot: TimelineSnapshotClock,
  progression: TimelineProgression,
  generateEvent: TimelineEventGenerator,
): TimelineProgressionSimulationResult => {
  let requestedSteps: number;
  let maximumAdvanceDays: number;
  let stopReason: TimelineProgressionResult["stopReason"];
  switch (progression.mode) {
    case "months":
      if (
        !Number.isSafeInteger(progression.months) ||
        progression.months < 1 ||
        progression.months > MAX_MONTHS
      ) {
        throw new TimelineProgressionRangeError("INVALID_MONTHS");
      }
      requestedSteps = progression.months;
      maximumAdvanceDays = progression.months * DAYS_PER_MONTH;
      stopReason = "requested_duration";
      break;
    case "until_major_event":
      requestedSteps = MAX_UNTIL_EVENT_STEPS;
      maximumAdvanceDays = MAX_UNTIL_EVENT_DAYS;
      stopReason = "horizon_reached";
      break;
    default:
      return assertNever(progression);
  }

  const events: CampaignWorldEvent[] = [];
  let advanceDays = 0;
  let majorEventId: string | undefined;
  let steps = 0;

  for (let step = 1; step <= requestedSteps; step += 1) {
    const remainingDays = maximumAdvanceDays - advanceDays;
    if (remainingDays <= 0) {
      break;
    }

    advanceDays += Math.min(DAYS_PER_MONTH, remainingDays);
    steps = step;
    const clock = Object.freeze({
      elapsedDays: snapshot.elapsedDays + advanceDays,
      date: dateAfterDays(snapshot.date, advanceDays),
      step,
    });
    const generated = generateEvent(clock);
    if (generated === null) {
      continue;
    }

    const parsed = CampaignWorldEventSchema.safeParse(generated);
    if (!parsed.success) {
      throw new TimelineProgressionRangeError("MALFORMED_GENERATED_EVENT", step);
    }
    events.push(parsed.data);
    if (progression.mode === "until_major_event" && parsed.data.importance === "major") {
      majorEventId = parsed.data.id;
      stopReason = "major_event";
      break;
    }
  }

  return Object.freeze({
    mode: progression.mode,
    advanceDays,
    steps,
    stopReason,
    ...(majorEventId === undefined ? {} : { majorEventId }),
    elapsedDays: snapshot.elapsedDays + advanceDays,
    date: dateAfterDays(snapshot.date, advanceDays),
    events: Object.freeze(events),
  });
};
