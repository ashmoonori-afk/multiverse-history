import { z } from "zod";

import { parseNationId } from "../shared/ids";
import type { CampaignState } from "./campaign-state";

const NationIdSchema = z.string().regex(/^nat_[a-z0-9_]+$/);
const ProvinceIdSchema = z.string().regex(/^prv_[a-z0-9_]+$/);
const UnitIdSchema = z.string().regex(/^unt_[a-z0-9_]+$/);

const UnitOpSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("spawn"),
      ownerNationId: NationIdSchema,
      provinceId: ProvinceIdSchema,
      manpower: z.number().safe().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      op: z.literal("move"),
      unitId: UnitIdSchema,
      provinceId: ProvinceIdSchema,
    })
    .strict(),
  z.object({ op: z.literal("remove"), unitId: UnitIdSchema }).strict(),
  z
    .object({
      op: z.literal("strength"),
      unitId: UnitIdSchema,
      manpower: z.number().safe().int().nonnegative(),
    })
    .strict(),
]);

/**
 * Region ownership override: tracks which province changed hands.
 * Applied as a layer on top of the base scenario provinces.
 */
export interface RegionOwnershipOverride {
  readonly regionId: string;
  readonly toNationId: string;
  readonly fromNationId?: string;
  readonly note?: string;
  readonly sourceEventId?: string;
}

export const RegionOwnershipOverrideSchema = z
  .object({
    regionId: ProvinceIdSchema,
    toNationId: NationIdSchema,
    fromNationId: NationIdSchema.optional(),
    note: z.string().max(500).optional(),
    sourceEventId: z
      .string()
      .regex(/^evt_[a-z0-9_]+$/)
      .optional(),
  })
  .strict()
  .readonly();

/**
 * Structured event impact: what changed in the world.
 * Inspired by Open Historia's applyEventImpactsToWorld.
 */
export const EventImpactSchema = z
  .object({
    regionTransfers: z.array(RegionOwnershipOverrideSchema).default([]),
    nationChanges: z
      .array(
        z
          .object({
            nationId: NationIdSchema,
            name: z.string().max(200).optional(),
            color: z.string().max(7).optional(),
            stabilityChange: z.number().safe().int().min(-10_000).max(10_000).optional(),
            treasuryChange: z.number().safe().int().optional(),
          })
          .strict(),
      )
      .default([]),
    relationChanges: z
      .array(
        z
          .object({
            fromNationId: NationIdSchema,
            toNationId: NationIdSchema,
            delta: z.number().safe().int().min(-10_000).max(10_000),
          })
          .strict(),
      )
      .default([]),
    unitOps: z.array(UnitOpSchema).default([]),
  })
  .strict()
  .readonly();

type ParsedEventImpact = z.infer<typeof EventImpactSchema>;
export type EventImpact = Readonly<{
  [Key in keyof ParsedEventImpact]: Readonly<ParsedEventImpact[Key]>;
}>;

export const EMPTY_EVENT_IMPACT: EventImpact = Object.freeze({
  regionTransfers: Object.freeze([]),
  nationChanges: Object.freeze([]),
  relationChanges: Object.freeze([]),
  unitOps: Object.freeze([]),
});

const requireNation = (state: CampaignState, nationId: string): void => {
  if (!state.nations.some((nation) => nation.id === nationId)) {
    throw new RangeError("EVENT_IMPACT_NATION_INVALID");
  }
};

const requireProvince = (state: CampaignState, provinceId: string): void => {
  if (!state.provinces.some((province) => province.id === provinceId)) {
    throw new RangeError("EVENT_IMPACT_PROVINCE_INVALID");
  }
};

const requireUnit = (state: CampaignState, unitId: string): void => {
  if (!state.units.some((unit) => unit.id === unitId)) {
    throw new RangeError("EVENT_IMPACT_UNIT_INVALID");
  }
};

const applyRegionTransfers = (
  state: CampaignState,
  transfers: EventImpact["regionTransfers"],
): CampaignState => {
  let next = state;
  for (const transfer of transfers) {
    requireProvince(next, transfer.regionId);
    requireNation(next, transfer.toNationId);
    if (transfer.fromNationId !== undefined) requireNation(next, transfer.fromNationId);
    next = {
      ...next,
      provinces: Object.freeze(
        next.provinces.map((candidate) =>
          candidate.id === transfer.regionId
            ? Object.freeze({
                ...candidate,
                ownerNationId: parseNationId(transfer.toNationId),
              })
            : candidate,
        ),
      ),
    };
  }
  return next;
};

const applyNationChange = (
  nation: CampaignState["nations"][number],
  change: EventImpact["nationChanges"][number],
): CampaignState["nations"][number] => {
  if (nation.id !== change.nationId) return nation;
  return Object.freeze({
    ...nation,
    ...(change.name !== undefined ? { nameKo: change.name } : {}),
    ...(change.stabilityChange !== undefined
      ? {
          stabilityBps: Math.max(0, Math.min(10_000, nation.stabilityBps + change.stabilityChange)),
        }
      : {}),
    ...(change.treasuryChange !== undefined
      ? { treasuryCredits: Math.max(0, nation.treasuryCredits + change.treasuryChange) }
      : {}),
  });
};

const applyNationChanges = (
  state: CampaignState,
  changes: EventImpact["nationChanges"],
): CampaignState => {
  let next = state;
  for (const change of changes) {
    requireNation(next, change.nationId);
    next = {
      ...next,
      nations: Object.freeze(next.nations.map((nation) => applyNationChange(nation, change))),
    };
  }
  return next;
};

const applyRelationChanges = (
  state: CampaignState,
  changes: EventImpact["relationChanges"],
): CampaignState => {
  let next = state;
  for (const change of changes) {
    requireNation(next, change.fromNationId);
    requireNation(next, change.toNationId);
    const existing = next.relations.find(
      (relation) =>
        relation.fromNationId === change.fromNationId && relation.toNationId === change.toNationId,
    );
    const value = Math.max(-10_000, Math.min(10_000, (existing?.value ?? 0) + change.delta));
    next = {
      ...next,
      relations: Object.freeze(
        existing
          ? next.relations.map((relation) =>
              relation.fromNationId === change.fromNationId &&
              relation.toNationId === change.toNationId
                ? Object.freeze({ ...relation, value })
                : relation,
            )
          : [
              ...next.relations,
              Object.freeze({
                fromNationId: parseNationId(change.fromNationId),
                toNationId: parseNationId(change.toNationId),
                value,
              }),
            ],
      ),
    };
  }
  return next;
};

type UnitOp = EventImpact["unitOps"][number];

const spawnUnit = (state: CampaignState, op: Extract<UnitOp, { op: "spawn" }>): CampaignState => {
  requireNation(state, op.ownerNationId);
  requireProvince(state, op.provinceId);
  return {
    ...state,
    units: Object.freeze([
      ...state.units,
      Object.freeze({
        id: `unt_${state.turn}_${state.units.length}`,
        ownerNationId: op.ownerNationId,
        provinceId: op.provinceId,
        manpower: op.manpower,
      }),
    ]),
  };
};

const removeUnit = (state: CampaignState, op: Extract<UnitOp, { op: "remove" }>): CampaignState => {
  requireUnit(state, op.unitId);
  return {
    ...state,
    units: Object.freeze(state.units.filter((unit) => unit.id !== op.unitId)),
  };
};

const changeUnitStrength = (
  state: CampaignState,
  op: Extract<UnitOp, { op: "strength" }>,
): CampaignState => {
  requireUnit(state, op.unitId);
  return {
    ...state,
    units: Object.freeze(
      state.units.map((unit) =>
        unit.id === op.unitId ? Object.freeze({ ...unit, manpower: op.manpower }) : unit,
      ),
    ),
  };
};

const moveUnit = (state: CampaignState, op: Extract<UnitOp, { op: "move" }>): CampaignState => {
  requireUnit(state, op.unitId);
  requireProvince(state, op.provinceId);
  return {
    ...state,
    units: Object.freeze(
      state.units.map((unit) =>
        unit.id === op.unitId ? Object.freeze({ ...unit, provinceId: op.provinceId }) : unit,
      ),
    ),
  };
};

const applyUnitOp = (state: CampaignState, op: UnitOp): CampaignState => {
  switch (op.op) {
    case "spawn":
      return spawnUnit(state, op);
    case "remove":
      return removeUnit(state, op);
    case "strength":
      return changeUnitStrength(state, op);
    case "move":
      return moveUnit(state, op);
  }
};

const applyUnitOps = (state: CampaignState, operations: EventImpact["unitOps"]): CampaignState => {
  let next = state;
  for (const operation of operations) {
    next = applyUnitOp(next, operation);
  }
  return next;
};

/**
 * Apply event impacts to campaign state.
 * Inspired by Open Historia's applyEventImpactsToWorld.
 */
export const applyEventImpacts = (
  state: CampaignState,
  impacts: readonly EventImpact[],
): CampaignState => {
  let next = state;
  for (const impact of impacts) {
    next = applyRegionTransfers(next, impact.regionTransfers);
    next = applyNationChanges(next, impact.nationChanges);
    next = applyRelationChanges(next, impact.relationChanges);
    next = applyUnitOps(next, impact.unitOps);
  }
  return next;
};

/**
 * Build region ownership overrides from state before/after.
 * Returns the overrides that the event should record.
 */
export const buildRegionOwnershipOverrides = (
  before: CampaignState,
  after: CampaignState,
  sourceEventId?: string,
): readonly RegionOwnershipOverride[] => {
  const overrides: RegionOwnershipOverride[] = [];
  for (const afterProvince of after.provinces) {
    const beforeProvince = before.provinces.find((p) => p.id === afterProvince.id);
    if (beforeProvince && beforeProvince.ownerNationId !== afterProvince.ownerNationId) {
      overrides.push(
        Object.freeze({
          regionId: afterProvince.id,
          toNationId: afterProvince.ownerNationId,
          fromNationId: beforeProvince.ownerNationId,
          ...(sourceEventId !== undefined ? { sourceEventId } : {}),
        }),
      );
    }
  }
  return Object.freeze(overrides);
};

/**
 * Resolve the effective province ownership at a given event index.
 * Used for staged event reveal: the map shows ownership as of the Nth event.
 */
export const resolveOwnershipAtEvent = (
  state: CampaignState,
  eventIndex: number,
): ReadonlyMap<string, string> => {
  const ownership = new Map<string, string>();
  for (const province of state.provinces) {
    ownership.set(province.id, province.ownerNationId);
  }

  for (const event of state.worldEvents.toReversed()) {
    for (const transfer of event.impacts?.regionTransfers.toReversed() ?? []) {
      if (transfer.fromNationId !== undefined) {
        ownership.set(transfer.regionId, transfer.fromNationId);
      }
    }
  }
  const clampedIndex = Math.max(0, Math.min(eventIndex, state.worldEvents.length));
  for (const event of state.worldEvents.slice(0, clampedIndex)) {
    for (const transfer of event.impacts?.regionTransfers ?? []) {
      ownership.set(transfer.regionId, transfer.toNationId);
    }
  }
  return ownership;
};
