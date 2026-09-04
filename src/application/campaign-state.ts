import { z } from "zod";

import type { ScenarioDefinition } from "../domain/scenario/registry";
import { getScenarioById } from "../domain/scenario/registry";
import type { StrategicPlan } from "../providers/schemas";
import { parseStrategicPlan } from "../providers/schemas";
import { hashCanonical } from "../shared/canonical-json";
import { parseNationId, parseScenarioId } from "../shared/ids";
import {
  type CampaignChatMessage,
  CampaignChatMessageSchema,
  normalizeCampaignChatMessage,
} from "./campaign-chat";
import {
  type CampaignConstructionProject,
  CampaignConstructionProjectSchema,
} from "./campaign-construction";
import {
  type TimelineProgressionResult,
  TimelineProgressionResultSchema,
} from "./campaign-progression";
import { type CampaignNationReaction, CampaignNationReactionSchema } from "./campaign-reaction";
import { type CampaignResolution, CampaignResolutionSchema } from "./campaign-resolution";
import { migrateCampaignState } from "./campaign-state-migration";
import { type CampaignWorldEvent, CampaignWorldEventSchema } from "./campaign-world-event";
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
  readonly schemaVersion: 2;
  readonly id: "cmp_local";
  readonly scenarioId: string;
  readonly scenarioTitleKo: string;
  readonly playerNationId: string;
  readonly plannerProvider: "deterministic" | "codex" | "claude";
  readonly difficulty: "story" | "standard" | "hard";
  readonly elapsedDays: number;
  readonly date: { readonly year: number; readonly quarter: number };
  readonly nations: readonly CampaignNationState[];
  readonly provinces: readonly CampaignProvinceState[];
  readonly relations: ScenarioDefinition["relations"];
  readonly treaties: readonly CampaignTreatyState[];
  readonly units: readonly CampaignUnitState[];
  readonly wars: readonly CampaignWarState[];
  readonly battleReports: readonly string[];
  readonly lastPlan: StrategicPlan | null;
  readonly resolutions: readonly CampaignResolution[];
  readonly chatMessages: readonly CampaignChatMessage[];
  readonly constructionProjects: readonly CampaignConstructionProject[];
  readonly worldEvents: readonly CampaignWorldEvent[];
  readonly nationReactions: readonly CampaignNationReaction[];
  readonly lastProgression: TimelineProgressionResult | null;
}

export type CampaignNationState = ScenarioDefinition["nations"][number] & {
  readonly governmentKo?: string | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly manpowerPool?: number | undefined;
  readonly profile?:
    | {
        readonly goalsKo: readonly string[];
        readonly personalityKo: string;
        readonly rivalNationIds: readonly string[];
        readonly allyNationIds: readonly string[];
      }
    | undefined;
};

export type CampaignProvinceState = ScenarioDefinition["provinces"][number] & {
  readonly nameKo?: string | undefined;
  readonly adjacentProvinceIds?: readonly string[] | undefined;
  readonly isCapital?: boolean | undefined;
  readonly isPort?: boolean | undefined;
  readonly terrain?: string | undefined;
  readonly developmentBps?: number | undefined;
};

const CampaignStateSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.literal("cmp_local"),
    scenarioId: z.string().regex(/^scn_[a-z0-9_]+$/),
    scenarioTitleKo: z.string().trim().min(1).optional(),
    playerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    plannerProvider: z.enum(["deterministic", "codex", "claude"]).default("deterministic"),
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
          governmentKo: z.string().trim().min(1).optional(),
          tags: z.array(z.string().trim().min(1)).optional(),
          manpowerPool: z.number().safe().int().nonnegative().optional(),
          profile: z
            .object({
              goalsKo: z.array(z.string().trim().min(1)),
              personalityKo: z.string().trim().min(1),
              rivalNationIds: z.array(z.string().regex(/^nat_[a-z0-9_]+$/)),
              allyNationIds: z.array(z.string().regex(/^nat_[a-z0-9_]+$/)),
            })
            .strict()
            .optional(),
        })
        .strict(),
    ),
    provinces: z.array(
      z
        .object({
          id: z.string(),
          ownerNationId: z.string(),
          population: z.number().safe().int().nonnegative(),
          nameKo: z.string().trim().min(1).optional(),
          adjacentProvinceIds: z.array(z.string()).optional(),
          isCapital: z.boolean().optional(),
          isPort: z.boolean().optional(),
          terrain: z.string().trim().min(1).optional(),
          developmentBps: z.number().safe().int().min(0).max(10_000).optional(),
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
    constructionProjects: z.array(CampaignConstructionProjectSchema).default([]),
    worldEvents: z.array(CampaignWorldEventSchema).default([]),
    nationReactions: z.array(CampaignNationReactionSchema).default([]),
    lastProgression: TimelineProgressionResultSchema.nullable().default(null),
  })
  .strict();

export interface CampaignCreationOptions {
  readonly customPolityName?: string;
  readonly difficulty?: "story" | "standard" | "hard";
  readonly plannerProvider?: "deterministic" | "codex" | "claude";
}

export const createCampaignState = (
  scenarioId: string,
  playerNationId: string,
  options: CampaignCreationOptions = {},
): CampaignState =>
  createCampaignStateFromScenario(getScenarioById(scenarioId), playerNationId, options);

export const createCampaignStateFromScenario = (
  scenario: ScenarioDefinition,
  playerNationId: string,
  options: CampaignCreationOptions = {},
): CampaignState => {
  if (!scenario.playerNationIds.includes(parseNationId(playerNationId))) {
    throw new RangeError("PLAYER_NATION_NOT_PLAYABLE");
  }
  const customPolityName = options.customPolityName?.trim();
  if (customPolityName !== undefined && customPolityName.length === 0) {
    throw new RangeError("INVALID_CUSTOM_POLITY_NAME");
  }
  const initialUnits = scenario.initialUnits ?? [];
  for (const unit of initialUnits) {
    const province = scenario.provinces.find((candidate) => candidate.id === unit.provinceId);
    if (
      !scenario.nations.some((nation) => nation.id === unit.nationId) ||
      province === undefined ||
      province.ownerNationId !== unit.nationId
    ) {
      throw new RangeError("SCENARIO_INITIAL_UNIT_INVALID");
    }
  }
  return Object.freeze({
    schemaVersion: 2,
    id: "cmp_local",
    scenarioId: scenario.id,
    scenarioTitleKo: scenario.titleKo,
    playerNationId,
    plannerProvider: options.plannerProvider ?? "deterministic",
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
    units: Object.freeze(
      initialUnits.map(({ id, nationId, provinceId, manpower }) =>
        Object.freeze({ id, ownerNationId: nationId, provinceId, manpower }),
      ),
    ),
    wars: Object.freeze([]),
    battleReports: Object.freeze([]),
    events: Object.freeze([]),
    lastPlan: null,
    resolutions: Object.freeze([]),
    chatMessages: Object.freeze([]),
    constructionProjects: Object.freeze([]),
    worldEvents: Object.freeze([]),
    nationReactions: Object.freeze([]),
    lastProgression: null,
  });
};

export const parseCampaignState = (value: unknown): CampaignState => {
  const parsed = CampaignStateSchema.parse(migrateCampaignState(value));
  const lastPlan = parsed.lastPlan === null ? null : parseStrategicPlan(parsed.lastPlan);
  return Object.freeze({
    ...parsed,
    scenarioId: parseScenarioId(parsed.scenarioId),
    scenarioTitleKo: parsed.scenarioTitleKo ?? getScenarioById(parsed.scenarioId).titleKo,
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
    constructionProjects: Object.freeze(
      parsed.constructionProjects.map((project) => Object.freeze(project)),
    ),
    worldEvents: Object.freeze(
      parsed.worldEvents.map((event) =>
        Object.freeze({
          ...event,
          date: Object.freeze({ ...event.date }),
          actorNationIds: Object.freeze([...event.actorNationIds]),
          affectedNationIds: Object.freeze([...event.affectedNationIds]),
        }),
      ),
    ),
    nationReactions: Object.freeze(
      parsed.nationReactions.map((reaction) => Object.freeze(reaction)),
    ),
    lastProgression:
      parsed.lastProgression === null ? null : Object.freeze({ ...parsed.lastProgression }),
    chatMessages: Object.freeze(
      parsed.chatMessages.map((message) => {
        const { replyToMessageId, sourceKey, ...base } = message;
        return normalizeCampaignChatMessage(
          Object.freeze({
            ...base,
            ...(replyToMessageId === undefined ? {} : { replyToMessageId }),
            ...(sourceKey === undefined ? {} : { sourceKey }),
            date: Object.freeze({ ...message.date }),
            participantNationIds: Object.freeze([...message.participantNationIds]),
          }),
          parsed.playerNationId,
        );
      }),
    ),
    lastPlan,
  });
};

export type TimelineCadence = "week" | "month" | "quarter" | "year" | "major";

const timelineDays: Readonly<Record<TimelineCadence, number>> = Object.freeze({
  week: 7,
  month: 30,
  quarter: 91,
  year: 365,
  major: 365,
});

interface AdvanceCampaignClockInput {
  readonly elapsedDays: number;
  readonly date: CampaignState["date"];
  readonly cadence: TimelineCadence;
}

interface CampaignClock {
  readonly elapsedDays: number;
  readonly date: CampaignState["date"];
  readonly advanceDays: number;
}

export const advanceCampaignClock = (input: AdvanceCampaignClockInput): CampaignClock => {
  const advanceDays = timelineDays[input.cadence];
  const quarterSteps =
    input.cadence === "year" || input.cadence === "major" ? 4 : input.cadence === "quarter" ? 1 : 0;
  const nextQuarter = ((input.date.quarter - 1 + quarterSteps) % 4) + 1;
  const nextYear = input.date.year + Math.floor((input.date.quarter - 1 + quarterSteps) / 4);
  return Object.freeze({
    elapsedDays: input.elapsedDays + advanceDays,
    date: Object.freeze({ year: nextYear, quarter: nextQuarter }),
    advanceDays,
  });
};

export const jumpCampaignTimeline = (
  state: CampaignState,
  cadence: TimelineCadence,
): CampaignState => {
  const clock = advanceCampaignClock({
    elapsedDays: state.elapsedDays,
    date: state.date,
    cadence,
  });
  return Object.freeze({
    ...state,
    elapsedDays: clock.elapsedDays,
    date: clock.date,
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
