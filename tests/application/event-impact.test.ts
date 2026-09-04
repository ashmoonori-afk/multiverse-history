import { describe, expect, test } from "bun:test";

import { createCampaignResolution } from "../../src/application/campaign-resolution";
import { type CampaignState, createCampaignState } from "../../src/application/campaign-state";
import { CampaignWorldEventSchema } from "../../src/application/campaign-world-event";
import {
  applyEventImpacts,
  type EventImpact,
  EventImpactSchema,
} from "../../src/application/event-impact";
import { createCampaignWorldEvent } from "../../src/application/world-event-engine";
import { parseStrategicPlan } from "../../src/providers/schemas";
import { parseNationId } from "../../src/shared/ids";

const campaign = (): CampaignState => createCampaignState("scn_ea1900", "nat_kor");

const unitFixture = (state: CampaignState) => {
  const unit = state.units[0];
  const destination = state.provinces.find((province) => province.id !== unit?.provinceId);
  if (unit === undefined || destination === undefined) throw new RangeError("TEST_UNIT_MISSING");
  return { unit, destination };
};

const impactWith = (unitOp: EventImpact["unitOps"][number]): EventImpact =>
  EventImpactSchema.parse({ unitOps: [unitOp] });

describe("event impact contract", () => {
  test("requires the operation-specific unit fields and rejects marker operations", () => {
    // Given
    const state = campaign();
    const { destination, unit } = unitFixture(state);
    const accepted = [
      {
        op: "spawn",
        ownerNationId: state.playerNationId,
        provinceId: destination.id,
        manpower: 500,
      },
      { op: "move", unitId: unit.id, provinceId: destination.id },
      { op: "remove", unitId: unit.id },
      { op: "strength", unitId: unit.id, manpower: unit.manpower + 1 },
    ] as const;
    const malformed = [
      { op: "spawn" },
      { op: "move", unitId: unit.id },
      { op: "remove" },
      { op: "strength", unitId: unit.id },
      { op: "remove", unitId: unit.id, provinceId: destination.id },
    ] as const;

    // When / Then
    for (const unitOp of accepted) {
      expect(EventImpactSchema.safeParse({ unitOps: [unitOp] }).success).toBe(true);
    }
    for (const unitOp of malformed) {
      expect(EventImpactSchema.safeParse({ unitOps: [unitOp] }).success).toBe(false);
    }
    expect(EventImpactSchema.safeParse({ markerOps: [] }).success).toBe(false);
  });

  test("reduces every accepted unit operation", () => {
    // Given
    const state = campaign();
    const { destination, unit } = unitFixture(state);

    // When
    const spawned = applyEventImpacts(state, [
      impactWith({
        op: "spawn",
        ownerNationId: state.playerNationId,
        provinceId: destination.id,
        manpower: 500,
      }),
    ]);
    const moved = applyEventImpacts(state, [
      impactWith({ op: "move", unitId: unit.id, provinceId: destination.id }),
    ]);
    const removed = applyEventImpacts(state, [impactWith({ op: "remove", unitId: unit.id })]);
    const strengthened = applyEventImpacts(state, [
      impactWith({ op: "strength", unitId: unit.id, manpower: unit.manpower + 1 }),
    ]);

    // Then
    expect(spawned.units).toHaveLength(state.units.length + 1);
    expect(spawned.units.at(-1)).toMatchObject({
      ownerNationId: state.playerNationId,
      provinceId: destination.id,
      manpower: 500,
    });
    expect(moved.units.find((candidate) => candidate.id === unit.id)?.provinceId).toBe(
      destination.id,
    );
    expect(removed.units.some((candidate) => candidate.id === unit.id)).toBe(false);
    expect(strengthened.units.find((candidate) => candidate.id === unit.id)?.manpower).toBe(
      unit.manpower + 1,
    );
  });

  test("rejects syntactically valid references that are absent from campaign state", () => {
    // Given
    const state = campaign();
    const { destination, unit } = unitFixture(state);
    const invalidImpacts = [
      impactWith({
        op: "spawn",
        ownerNationId: "nat_missing",
        provinceId: destination.id,
        manpower: 500,
      }),
      impactWith({
        op: "spawn",
        ownerNationId: state.playerNationId,
        provinceId: "prv_missing",
        manpower: 500,
      }),
      impactWith({ op: "move", unitId: "unt_missing", provinceId: destination.id }),
      impactWith({ op: "move", unitId: unit.id, provinceId: "prv_missing" }),
      impactWith({ op: "remove", unitId: "unt_missing" }),
      impactWith({ op: "strength", unitId: "unt_missing", manpower: 500 }),
      EventImpactSchema.parse({
        regionTransfers: [{ regionId: "prv_missing", toNationId: state.playerNationId }],
      }),
      EventImpactSchema.parse({
        regionTransfers: [{ regionId: destination.id, toNationId: "nat_missing" }],
      }),
      EventImpactSchema.parse({ nationChanges: [{ nationId: "nat_missing", treasuryChange: 1 }] }),
      EventImpactSchema.parse({
        relationChanges: [
          { fromNationId: state.playerNationId, toNationId: "nat_missing", delta: 1 },
        ],
      }),
    ];

    // When / Then
    for (const impact of invalidImpacts) {
      expect(() => applyEventImpacts(state, [impact])).toThrow(RangeError);
    }
  });

  test("requires first-class event metadata and creates deterministic production defaults", () => {
    // Given
    const before = campaign();
    const transferredRegion = before.provinces.find(
      (province) => province.ownerNationId === before.playerNationId,
    );
    if (transferredRegion === undefined) throw new RangeError("TEST_PROVINCE_MISSING");
    const targetNationId = parseNationId("nat_jpn");
    const plan = parseStrategicPlan({
      schemaVersion: 2,
      requestId: "req_default_event",
      playerIntents: [],
      npcIntents: [
        {
          type: "action.fail",
          actorNationId: "nat_jpn",
          attemptKo: "현상 유지",
          stabilityDelta: 0,
        },
      ],
      narrative: { ko: "세계가 결정론적으로 변화한다." },
      warnings: [],
    });
    const reduced = Object.freeze({
      ...before,
      provinces: Object.freeze(
        before.provinces.map((province) =>
          province.id === transferredRegion.id
            ? Object.freeze({ ...province, ownerNationId: targetNationId })
            : province,
        ),
      ),
      lastPlan: plan,
    });
    const resolution = createCampaignResolution({
      before,
      after: reduced,
      turn: 1,
      cadence: "month",
      advanceDays: 30,
      orderText: "시간을 진행한다.",
      narrativeKo: plan.narrative.ko,
      changedProvinceIds: [transferredRegion.id],
    });

    // When
    const first = createCampaignWorldEvent({ before, reduced, resolution });
    const second = createCampaignWorldEvent({ before, reduced, resolution });

    // Then
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      impacts: {
        regionTransfers: [
          {
            regionId: transferredRegion.id,
            fromNationId: before.playerNationId,
            toNationId: targetNationId,
            sourceEventId: first.id,
          },
        ],
        nationChanges: [],
        relationChanges: [],
        unitOps: [],
      },
      provenance: "simulated_consequence",
      regionIds: [transferredRegion.id],
      sourceInputIds: [plan.requestId],
    });
    for (const field of ["impacts", "provenance", "regionIds", "sourceInputIds"] as const) {
      const malformed = { ...first };
      Reflect.deleteProperty(malformed, field);
      expect(CampaignWorldEventSchema.safeParse(malformed).success).toBe(false);
    }
  });
});
