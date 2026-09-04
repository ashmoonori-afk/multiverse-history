import { describe, expect, test } from "bun:test";

import type { CampaignWorldEvent } from "../../src/application/campaign-world-event";
import {
  simulateTimelineProgression,
  TimelineProgressionRangeError,
  type TimelineStepClock,
} from "../../src/application/timeline-progression";

const snapshot = Object.freeze({
  elapsedDays: 120,
  date: Object.freeze({ year: 1900, quarter: 1 as const }),
});

const eventAt = (
  id: string,
  importance: CampaignWorldEvent["importance"],
  clock: TimelineStepClock,
): CampaignWorldEvent => ({
  id,
  kind: "political",
  importance,
  occurredAtElapsedDays: clock.elapsedDays,
  turn: clock.step,
  date: clock.date,
  actorNationIds: ["nat_kor"],
  affectedNationIds: ["nat_jpn"],
  headlineKo: `사건 ${clock.step}`,
  summaryKo: `결정론적 사건 ${clock.step}`,
  impacts: {
    regionTransfers: [],
    nationChanges: [],
    relationChanges: [],
    unitOps: [],
  },
  provenance: "simulated_consequence",
  regionIds: [],
  sourceInputIds: [`req_step_${clock.step}`],
});

describe("pure timeline progression", () => {
  test("advances all 18 requested months when the maximum month duration is selected", () => {
    // Given
    const progression = { mode: "months", months: 18 } as const;

    // When
    const result = simulateTimelineProgression(snapshot, progression, () => null);

    // Then
    expect(result).toEqual({
      mode: "months",
      advanceDays: 540,
      steps: 18,
      stopReason: "requested_duration",
      elapsedDays: 660,
      date: { year: 1901, quarter: 3 },
      events: [],
    });
  });

  test("stops immediately after the first generated major event", () => {
    // Given
    const progression = { mode: "until_major_event" } as const;

    // When
    const result = simulateTimelineProgression(snapshot, progression, (clock) =>
      eventAt(`evt_step_${clock.step}`, clock.step === 3 ? "major" : "minor", clock),
    );

    // Then
    expect(result).toEqual({
      mode: "until_major_event",
      advanceDays: 90,
      steps: 3,
      stopReason: "major_event",
      majorEventId: "evt_step_3",
      elapsedDays: 210,
      date: { year: 1900, quarter: 2 },
      events: [
        eventAt("evt_step_1", "minor", { elapsedDays: 150, date: snapshot.date, step: 1 }),
        eventAt("evt_step_2", "minor", { elapsedDays: 180, date: snapshot.date, step: 2 }),
        eventAt("evt_step_3", "major", {
          elapsedDays: 210,
          date: { year: 1900, quarter: 2 },
          step: 3,
        }),
      ],
    });
  });

  test("returns horizon_reached when no event is generated before the bounded horizon", () => {
    // Given
    const progression = { mode: "until_major_event" } as const;
    const generatedClocks: TimelineStepClock[] = [];

    // When
    const result = simulateTimelineProgression(snapshot, progression, (clock) => {
      generatedClocks.push(clock);
      return null;
    });

    // Then
    expect(result).toMatchObject({
      mode: "until_major_event",
      advanceDays: 548,
      steps: 19,
      stopReason: "horizon_reached",
      elapsedDays: 668,
      date: { year: 1901, quarter: 3 },
      events: [],
    });
    expect(result.advanceDays).toBeLessThanOrEqual(548);
    expect(result.steps).toBeLessThanOrEqual(24);
    expect(generatedClocks).toHaveLength(19);
    expect(generatedClocks.at(-2)?.elapsedDays).toBe(660);
    expect(generatedClocks.at(-1)?.elapsedDays).toBe(668);
  });

  test("rejects zero requested months before generating events", () => {
    // Given
    const progression = { mode: "months", months: 0 } as const;
    let generationCalls = 0;

    // When
    const run = () =>
      simulateTimelineProgression(snapshot, progression, () => {
        generationCalls += 1;
        return null;
      });

    // Then
    expect(run).toThrow(TimelineProgressionRangeError);
    expect(generationCalls).toBe(0);
  });

  test("rejects requested months above 18 before generating events", () => {
    // Given
    const progression = { mode: "months", months: 19 } as const;
    let generationCalls = 0;

    // When
    const run = () =>
      simulateTimelineProgression(snapshot, progression, () => {
        generationCalls += 1;
        return null;
      });

    // Then
    expect(run).toThrow(TimelineProgressionRangeError);
    expect(generationCalls).toBe(0);
  });

  test("rejects a malformed generated event at its bounded generation step", () => {
    // Given
    const progression = { mode: "until_major_event" } as const;

    // When
    const run = () =>
      simulateTimelineProgression(snapshot, progression, () => ({
        id: "not-an-event-id",
        importance: "major",
      }));

    // Then
    expect(run).toThrow(TimelineProgressionRangeError);
  });

  test("produces identical results for identical snapshots and generators", () => {
    // Given
    const progression = { mode: "months", months: 4 } as const;
    const generate = (clock: TimelineStepClock) =>
      clock.step % 2 === 0 ? eventAt(`evt_step_${clock.step}`, "minor", clock) : null;

    // When
    const first = simulateTimelineProgression(snapshot, progression, generate);
    const second = simulateTimelineProgression(snapshot, progression, generate);

    // Then
    expect(second).toEqual(first);
  });

  test("does not mutate the snapshot or progression input", () => {
    // Given
    const mutableSnapshot = {
      elapsedDays: 120,
      date: { year: 1900, quarter: 1 as const },
    };
    const mutableProgression = { mode: "months" as const, months: 2 };
    const snapshotBefore = structuredClone(mutableSnapshot);
    const progressionBefore = structuredClone(mutableProgression);

    // When
    simulateTimelineProgression(mutableSnapshot, mutableProgression, () => null);

    // Then
    expect(mutableSnapshot).toEqual(snapshotBefore);
    expect(mutableProgression).toEqual(progressionBefore);
  });
});
