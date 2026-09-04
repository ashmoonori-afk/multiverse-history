import { describe, expect, test } from "bun:test";

import {
  createCampaignStateFromScenario,
  parseCampaignState,
} from "../../src/application/campaign-state";
import { advanceReveal, computeStagedReveal } from "../../src/application/staged-reveal";
import { getScenarioById } from "../../src/domain/scenario/registry";

describe("staged reveal ownership", () => {
  test("reconstructs original, first, and second owners for repeated province transfers", () => {
    // Given
    const initial = createCampaignStateFromScenario(getScenarioById("scn_ea1900"), "nat_kor");
    const province = initial.provinces.find((candidate) => candidate.ownerNationId === "nat_kor");
    if (province === undefined) throw new RangeError("TEST_PROVINCE_MISSING");
    const final = parseCampaignState({
      ...initial,
      provinces: initial.provinces.map((candidate) =>
        candidate.id === province.id ? { ...candidate, ownerNationId: "nat_qing" } : candidate,
      ),
      worldEvents: [
        {
          id: "evt_transfer_one",
          kind: "military",
          importance: "minor",
          occurredAtElapsedDays: 10,
          turn: 1,
          date: { year: 1900, quarter: 1 },
          actorNationIds: ["nat_jpn"],
          affectedNationIds: ["nat_kor", "nat_jpn"],
          headlineKo: "첫 번째 영토 이전",
          summaryKo: "일본이 해당 지역을 점령했다.",
          impacts: {
            regionTransfers: [
              {
                regionId: province.id,
                fromNationId: "nat_kor",
                toNationId: "nat_jpn",
                sourceEventId: "evt_transfer_one",
              },
            ],
            nationChanges: [],
            relationChanges: [],
            unitOps: [],
            markerOps: [],
          },
        },
        {
          id: "evt_transfer_two",
          kind: "military",
          importance: "major",
          occurredAtElapsedDays: 20,
          turn: 1,
          date: { year: 1900, quarter: 1 },
          actorNationIds: ["nat_qing"],
          affectedNationIds: ["nat_jpn", "nat_qing"],
          headlineKo: "두 번째 영토 이전",
          summaryKo: "청이 해당 지역을 다시 점령했다.",
          impacts: {
            regionTransfers: [
              {
                regionId: province.id,
                fromNationId: "nat_jpn",
                toNationId: "nat_qing",
                sourceEventId: "evt_transfer_two",
              },
            ],
            nationChanges: [],
            relationChanges: [],
            unitOps: [],
            markerOps: [],
          },
        },
      ],
    });

    // When
    const before = computeStagedReveal(final, -1);
    const afterFirst = advanceReveal(before);
    const afterSecond = computeStagedReveal(final, 99);

    // Then
    const ownerAt = (reveal: typeof before): string | undefined => {
      const owner = reveal.worldState.provinces.find(
        (candidate) => candidate.id === province.id,
      )?.ownerNationId;
      return owner === undefined ? undefined : String(owner);
    };
    expect(ownerAt(before)).toBe("nat_kor");
    expect(ownerAt(afterFirst)).toBe("nat_jpn");
    expect(ownerAt(afterSecond)).toBe("nat_qing");
    expect(before).toMatchObject({
      currentIndex: 0,
      currentEventId: "evt_transfer_one",
      nextEventId: "evt_transfer_two",
    });
    expect(afterFirst).toMatchObject({
      currentIndex: 1,
      currentEventId: "evt_transfer_two",
      nextEventId: null,
    });
    expect(afterSecond).toMatchObject({ currentIndex: 2, complete: true, currentEventId: null });
  });
});
