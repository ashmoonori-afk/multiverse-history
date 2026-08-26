import { z } from "zod";

import type { ScenarioDefinition } from "../domain/scenario/registry";
import { getScenarioById } from "../domain/scenario/registry";
import type { StrategicPlan } from "../providers/schemas";
import { parseStrategicPlan } from "../providers/schemas";
import { hashCanonical } from "../shared/canonical-json";
import { parseNationId, parseScenarioId } from "../shared/ids";
import { type CampaignChatMessage, CampaignChatMessageSchema } from "./campaign-chat";
import { type CampaignResolution, CampaignResolutionSchema } from "./campaign-resolution";
import type { CampaignStore, CampaignTurnState } from "./turn-transaction";

export interface CampaignTreatyState {
  readonly id: string;
  readonly proposerNationId: string;
  readonly recipientNationId: string;
  readonly clauses: readonly string[];
  readonly status: "proposed" | "active";
  readonly proposedTurn: number;
}

export interface CampaignUnitState {
  readonly id: string;
  readonly ownerNationId: string;
  readonly provinceId: string;
  readonly manpower: number;
}

export interface CampaignWarState {
  readonly attackerNationId: string;
  readonly targetNationId: string;
  readonly declaredTurn: number;
}

export interface CampaignState extends CampaignTurnState {
  readonly id: "cmp_local";
  readonly scenarioId: string;
  readonly playerNationId: string;
  readonly difficulty: "story" | "standard" | "hard";
  readonly elapsedDays: number;
  readonly date: { readonly year: number; readonly quarter: number };
  readonly nations: ScenarioDefinition["nations"];
  readonly provinces: ScenarioDefinition["provinces"];
  readonly relations: ScenarioDefinition["relations"];
  readonly treaties: readonly CampaignTreatyState[];
  readonly units: readonly CampaignUnitState[];
  readonly wars: readonly CampaignWarState[];
  readonly battleReports: readonly string[];
  readonly lastPlan: StrategicPlan | null;
  readonly resolutions: readonly CampaignResolution[];
  readonly chatMessages: readonly CampaignChatMessage[];
}

const CampaignStateSchema = z
  .object({
    id: z.literal("cmp_local"),
    scenarioId: z.string().regex(/^scn_[a-z0-9_]+$/),
    playerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    difficulty: z.enum(["story", "standard", "hard"]),
    elapsedDays: z.number().safe().int().nonnegative(),
    turn: z.number().safe().int().nonnegative(),
    date: z
      .object({
        year: z.number().safe().int(),
        quarter: z.number().safe().int().min(1).max(4),
      })
      .strict(),
    nations: z.array(
      z
        .object({
          id: z.string(),
          nameKo: z.string(),
          capitalLabelKo: z.string().min(1),
          legalActions: z.array(z.string().min(1)),
          treasuryCredits: z.number().safe().int().nonnegative(),
          gdpCredits: z.number().safe().int().nonnegative(),
          taxRateBps: z.number().safe().int().min(0).max(10_000),
          stabilityBps: z.number().safe().int().min(0).max(10_000),
          population: z.number().safe().int().nonnegative(),
          infrastructureBps: z.number().safe().int().min(0).max(10_000),
        })
        .strict(),
    ),
    provinces: z.array(
      z
        .object({
          id: z.string(),
          ownerNationId: z.string(),
          population: z.number().safe().int().nonnegative(),
        })
        .strict(),
    ),
    relations: z.array(
      z
        .object({
          fromNationId: z.string(),
          toNationId: z.string(),
          value: z.number().safe().int().min(-10_000).max(10_000),
        })
        .strict(),
    ),
    treaties: z.array(
      z
        .object({
          id: z.string(),
          proposerNationId: z.string(),
          recipientNationId: z.string(),
          clauses: z.array(z.string()),
          status: z.enum(["proposed", "active"]),
          proposedTurn: z.number().safe().int().nonnegative(),
        })
        .strict(),
    ),
    units: z.array(
      z
        .object({
          id: z.string(),
          ownerNationId: z.string(),
          provinceId: z.string(),
          manpower: z.number().safe().int().nonnegative(),
        })
        .strict(),
    ),
    wars: z.array(
      z
        .object({
          attackerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
          targetNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
          declaredTurn: z.number().safe().int().nonnegative(),
        })
        .strict(),
    ),
    battleReports: z.array(z.string()),
    events: z.array(z.string()),
    lastPlan: z.unknown().nullable(),
    resolutions: z.array(CampaignResolutionSchema).default([]),
    chatMessages: z.array(CampaignChatMessageSchema).default([]),
  })
  .strict();

export interface CampaignCreationOptions {
  readonly customPolityName?: string;
  readonly difficulty?: "story" | "standard" | "hard";
}

export const createCampaignState = (
  scenarioId: string,
  playerNationId: string,
  options: CampaignCreationOptions = {},
): CampaignState => {
  const scenario = getScenarioById(scenarioId);
  if (!scenario.playerNationIds.includes(parseNationId(playerNationId))) {
    throw new RangeError("PLAYER_NATION_NOT_PLAYABLE");
  }
  const customPolityName = options.customPolityName?.trim();
  if (customPolityName !== undefined && customPolityName.length === 0) {
    throw new RangeError("INVALID_CUSTOM_POLITY_NAME");
  }
  return Object.freeze({
    id: "cmp_local",
    scenarioId: scenario.id,
    playerNationId,
    difficulty: options.difficulty ?? "standard",
    elapsedDays: 0,
    turn: 0,
    date: Object.freeze({ year: scenario.year, quarter: scenario.quarter }),
    nations: Object.freeze(
      scenario.nations.map((nation) =>
        Object.freeze({
          ...nation,
          ...(nation.id === playerNationId && customPolityName !== undefined
            ? { nameKo: customPolityName }
            : {}),
        }),
      ),
    ),
    provinces: Object.freeze(scenario.provinces.map((province) => Object.freeze({ ...province }))),
    relations: Object.freeze(scenario.relations.map((relation) => Object.freeze({ ...relation }))),
    treaties: Object.freeze([]),
    units: Object.freeze([]),
    wars: Object.freeze([]),
    battleReports: Object.freeze([]),
    events: Object.freeze([]),
    lastPlan: null,
    resolutions: Object.freeze([]),
    chatMessages: Object.freeze([]),
  });
};

export const parseCampaignState = (value: unknown): CampaignState => {
  const parsed = CampaignStateSchema.parse(value);
  const lastPlan = parsed.lastPlan === null ? null : parseStrategicPlan(parsed.lastPlan);
  return Object.freeze({
    ...parsed,
    scenarioId: parseScenarioId(parsed.scenarioId),
    playerNationId: parseNationId(parsed.playerNationId),
    nations: Object.freeze(
      parsed.nations.map((nation) => Object.freeze({ ...nation, id: parseNationId(nation.id) })),
    ),
    provinces: Object.freeze(
      parsed.provinces.map((province) =>
        Object.freeze({
          ...province,
          ownerNationId: parseNationId(province.ownerNationId),
        }),
      ),
    ),
    relations: Object.freeze(
      parsed.relations.map((relation) =>
        Object.freeze({
          ...relation,
          fromNationId: parseNationId(relation.fromNationId),
          toNationId: parseNationId(relation.toNationId),
        }),
      ),
    ),
    wars: Object.freeze(
      parsed.wars.map((war) =>
        Object.freeze({
          ...war,
          attackerNationId: parseNationId(war.attackerNationId),
          targetNationId: parseNationId(war.targetNationId),
        }),
      ),
    ),
    battleReports: Object.freeze([...parsed.battleReports]),
    resolutions: Object.freeze(parsed.resolutions.map((resolution) => Object.freeze(resolution))),
    chatMessages: Object.freeze(
      parsed.chatMessages.map((message) =>
        Object.freeze({
          ...message,
          date: Object.freeze({ ...message.date }),
        }),
      ),
    ),
    lastPlan,
  });
};

export type TimelineCadence = "week" | "month" | "quarter" | "year" | "major";

const timelineDays: Readonly<Record<TimelineCadence, number>> = {
  week: 7,
  month: 30,
  quarter: 91,
  year: 365,
  major: 365,
};

export const jumpCampaignTimeline = (
  state: CampaignState,
  cadence: TimelineCadence,
): CampaignState => {
  const days = timelineDays[cadence];
  const quarterSteps =
    cadence === "year" || cadence === "major" ? 4 : cadence === "quarter" ? 1 : 0;
  const nextQuarter = ((state.date.quarter - 1 + quarterSteps) % 4) + 1;
  const nextYear = state.date.year + Math.floor((state.date.quarter - 1 + quarterSteps) / 4);
  return Object.freeze({
    ...state,
    elapsedDays: state.elapsedDays + days,
    date: Object.freeze({ year: nextYear, quarter: nextQuarter }),
    events: Object.freeze([...state.events, `시간 이동: ${cadence}`]),
  });
};

export class LocalCampaignStore implements CampaignStore {
  #state: CampaignState | undefined;

  hasCampaign(): boolean {
    return this.#state !== undefined;
  }

  read(): CampaignState {
    if (this.#state === undefined) {
      throw new RangeError("CAMPAIGN_NOT_STARTED");
    }
    return this.#state;
  }

  replace(state: CampaignTurnState): void {
    this.#state = parseCampaignState(state);
  }

  stateHash(): string {
    return hashCanonical(this.read());
  }
}
