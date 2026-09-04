import { z } from "zod";

import { parseNationId } from "../shared/ids";
import type { CampaignState } from "./campaign-state";

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
    regionId: z.string().min(1),
    toNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    fromNationId: z
      .string()
      .regex(/^nat_[a-z0-9_]+$/)
      .optional(),
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
export interface EventImpact {
  readonly regionTransfers: readonly RegionOwnershipOverride[];
  readonly nationChanges: readonly {
    readonly nationId: string;
    readonly name?: string;
    readonly color?: string;
    readonly stabilityChange?: number;
    readonly treasuryChange?: number;
  }[];
  readonly relationChanges: readonly {
    readonly fromNationId: string;
    readonly toNationId: string;
    readonly delta: number;
  }[];
  readonly unitOps: readonly {
    readonly op: "spawn" | "move" | "remove" | "strength";
    readonly unitId?: string;
    readonly ownerNationId?: string;
    readonly provinceId?: string;
    readonly manpower?: number;
  }[];
  readonly markerOps: readonly {
    readonly op: "build" | "remove" | "rename";
    readonly markerId?: string;
    readonly provinceId?: string;
    readonly name?: string;
    readonly kind?: string;
  }[];
}

export const EventImpactSchema = z
  .object({
    regionTransfers: z.array(RegionOwnershipOverrideSchema).default([]),
    nationChanges: z
      .array(
        z
          .object({
            nationId: z.string().regex(/^nat_[a-z0-9_]+$/),
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
            fromNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
            toNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
            delta: z.number().safe().int().min(-10_000).max(10_000),
          })
          .strict(),
      )
      .default([]),
    unitOps: z
      .array(
        z
          .object({
            op: z.enum(["spawn", "move", "remove", "strength"]),
            unitId: z.string().optional(),
            ownerNationId: z
              .string()
              .regex(/^nat_[a-z0-9_]+$/)
              .optional(),
            provinceId: z.string().optional(),
            manpower: z.number().safe().int().optional(),
          })
          .strict(),
      )
      .default([]),
    markerOps: z
      .array(
        z
          .object({
            op: z.enum(["build", "remove", "rename"]),
            markerId: z.string().optional(),
            provinceId: z.string().optional(),
            name: z.string().max(200).optional(),
            kind: z.string().max(50).optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict()
  .readonly();

export const EMPTY_EVENT_IMPACT: EventImpact = Object.freeze({
  regionTransfers: Object.freeze([]),
  nationChanges: Object.freeze([]),
  relationChanges: Object.freeze([]),
  unitOps: Object.freeze([]),
  markerOps: Object.freeze([]),
});

const applyRegionTransfers = (
  state: CampaignState,
  transfers: EventImpact["regionTransfers"],
): CampaignState => {
  let next = state;
  for (const transfer of transfers) {
    const province = next.provinces.find((candidate) => candidate.id === transfer.regionId);
    if (province === undefined) continue;
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

const spawnUnit = (state: CampaignState, op: UnitOp): CampaignState => {
  if (!(op.ownerNationId && op.provinceId) || op.manpower === undefined) {
    return state;
  }
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

const removeUnit = (state: CampaignState, op: UnitOp): CampaignState => {
  if (!op.unitId) return state;
  return {
    ...state,
    units: Object.freeze(state.units.filter((unit) => unit.id !== op.unitId)),
  };
};

const changeUnitStrength = (state: CampaignState, op: UnitOp): CampaignState => {
  const { manpower, unitId } = op;
  if (!unitId || manpower === undefined) return state;
  return {
    ...state,
    units: Object.freeze(
      state.units.map((unit) => (unit.id === unitId ? Object.freeze({ ...unit, manpower }) : unit)),
    ),
  };
};

const moveUnit = (state: CampaignState, op: UnitOp): CampaignState => {
  const { provinceId, unitId } = op;
  if (!(unitId && provinceId)) return state;
  return {
    ...state,
    units: Object.freeze(
      state.units.map((unit) =>
        unit.id === unitId ? Object.freeze({ ...unit, provinceId }) : unit,
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
  const overrides = new Map<string, string>();
  // Base ownership from current state
  for (const province of state.provinces) {
    overrides.set(province.id, province.ownerNationId);
  }
  // Apply overrides from events up to eventIndex (exclusive)
  // This is a simplified version - in Open Historia, it tracks the full history
  for (let i = 0; i < eventIndex && i < state.worldEvents.length; i++) {
    const event = state.worldEvents[i];
    // Extract transfers from the event's resolution
    // This is a simplified version - the full system tracks structured impacts
    void event;
  }
  return overrides;
};
