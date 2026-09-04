import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError, z } from "zod";

import { deterministicCounterpartReply } from "../application/campaign-chat";
import {
  type CampaignGroupChatResponder,
  type CampaignGroupChatResponderInput,
  executeCampaignGroupChat,
} from "../application/campaign-group-chat";
import type {
  CampaignNewsAuthor,
  CampaignNewsAuthorInput,
} from "../application/campaign-news-finalization";
import {
  type CampaignState,
  createCampaignStateFromScenario,
  LocalCampaignStore,
  parseCampaignState,
} from "../application/campaign-state";
import {
  type AdvanceHorizon,
  advanceCampaignTimelineProgression,
} from "../application/campaign-timeline-progression";
import { finalizeCampaignTurn } from "../application/campaign-turn-finalization";
import type {
  CampaignReactionAuthor,
  CampaignReactionAuthorInput,
} from "../application/campaign-world-feedback";
import { groundStrategicPlan } from "../application/ground-strategic-plan";
import { buildPlannerStateJson } from "../application/planner-context";
import { executeProviderTurn, ProviderTurnError } from "../application/turn-transaction";
import {
  declareCampaignWar,
  moveCampaignUnit,
  proposeCampaignTreaty,
  recruitCampaignUnit,
  resolveCampaignCombat,
  transferCampaignProvince,
} from "../application/warfare-actions";
import {
  type CampaignWorldEventFactory,
  createCampaignWorldEvent,
} from "../application/world-event-engine";
import { listBuiltInScenarioMetadata, listCanonicalCountries } from "../domain/scenario/catalog";
import { validateScenarioPackage } from "../domain/scenario/package";
import { getScenarioById, listScenarios, loadScenarioById } from "../domain/scenario/registry";
import {
  autosaveAfterTurn,
  createCampaignSlotStore,
  replaceCampaignFromExport,
} from "../persistence/campaign-slot-store";
import { serializeCampaignExport } from "../persistence/export-import";
import { planDeterministically } from "../providers/deterministic-provider";
import { respondWithLiveDiplomacy } from "../providers/live-diplomacy";
import { authorLiveNews } from "../providers/live-news";
import { planWithLiveProvider } from "../providers/live-planner";
import { authorLiveReactionsBatch } from "../providers/live-reaction";
import { type StrategicPlan, strategicPlanCore } from "../providers/schemas";
import type { StructuredInvocationRunner } from "../providers/structured-invocation";
import { canonicalStringify, hashCanonical } from "../shared/canonical-json";
import {
  AdvanceTurnRequestSchema,
  CreateCampaignRequestSchema,
  DeclareWarRequestSchema,
  DiplomacyChatRequestSchema,
  JumpTimelineRequestSchema,
  MoveUnitRequestSchema,
  ProposeTreatyRequestSchema,
  RecruitUnitRequestSchema,
  TransferTerritoryRequestSchema,
} from "./contracts";

export type ProviderSelection = "deterministic" | "codex" | "claude";
export interface ProviderPlanInput {
  readonly requestId: string;
  readonly orderText: string;
  readonly turn: number;
  readonly stateJson: string;
  readonly playerNationId?: string;
  readonly playerProvinceId?: string;
  readonly validNationIds?: readonly string[];
  readonly validProvinceIds?: readonly string[];
  readonly npcActors?: readonly {
    readonly actorNationId: string;
    readonly provinceId: string;
  }[];
}
export type ProviderPlanner = (input: ProviderPlanInput) => Promise<StrategicPlan>;

export type ProviderDiplomacyInput = CampaignGroupChatResponderInput;
export type ProviderDiplomacyResponder = CampaignGroupChatResponder;

export interface GameAppOptions {
  readonly planners?: Partial<Readonly<Record<ProviderSelection, ProviderPlanner>>>;
  readonly diplomacyResponders?: Partial<
    Readonly<Record<ProviderSelection, ProviderDiplomacyResponder>>
  >;
  readonly newsAuthors?: Partial<Readonly<Record<ProviderSelection, CampaignNewsAuthor>>>;
  readonly reactionAuthors?: Partial<Readonly<Record<ProviderSelection, CampaignReactionAuthor>>>;
  readonly worldEventFactory?: CampaignWorldEventFactory;
  readonly slotDirectory?: string;
  readonly livePlannerRunner?: StructuredInvocationRunner;
}

export type TurnAutosaveStatus =
  | Readonly<{ status: "saved"; slot: "autosave" }>
  | Readonly<{
      status: "failed";
      slot: "autosave";
      error: Readonly<{ code: "autosave_failed"; recoverable: true }>;
      retry: Readonly<{ method: "POST"; path: "/api/campaigns/autosave/save" }>;
    }>;

const failedAutosaveStatus: TurnAutosaveStatus = Object.freeze({
  status: "failed",
  slot: "autosave",
  error: Object.freeze({ code: "autosave_failed", recoverable: true }),
  retry: Object.freeze({ method: "POST", path: "/api/campaigns/autosave/save" }),
});

const setTurnAutosaveHeader = (context: Context, autosave: TurnAutosaveStatus): void => {
  context.header("x-pax-autosave", JSON.stringify(autosave));
};

let testSlotRoot: string | undefined;
let testSlotSequence = 0;

export const cleanupTestSlotRoot = (): void => {
  if (testSlotRoot === undefined) return;
  rmSync(testSlotRoot, { recursive: true, force: true });
  testSlotRoot = undefined;
  testSlotSequence = 0;
};

const defaultSlotDirectory = (): string => {
  if (process.env.NODE_ENV !== "test") return "data/campaigns";
  testSlotRoot ??= mkdtempSync(join(tmpdir(), "pax-api-test-slots-"));
  return join(testSlotRoot, String(testSlotSequence++));
};

const MAX_JSON_BODY_BYTES = 1024 * 1024;
const MAX_CAMPAIGN_IMPORT_BYTES = 10 * 1024 * 1024;

const boundedBodyText = async (
  request: Request,
  maxBytes: number,
  tooLargeCode: string,
): Promise<string> => {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new TypeError("INVALID_CONTENT_LENGTH");
    if (BigInt(contentLength) > BigInt(maxBytes)) throw new RangeError(tooLargeCode);
  }
  const reader = request.body?.getReader();
  if (reader === undefined) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RangeError(tooLargeCode);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, bytes).toString("utf8");
};

const jsonBody = async (
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
  tooLargeCode = "REQUEST_BODY_TOO_LARGE",
): Promise<unknown> => {
  const text = await boundedBodyText(request, maxBytes, tooLargeCode);
  try {
    return JSON.parse(text);
  } catch {
    throw new TypeError("INVALID_JSON_BODY");
  }
};

const TurnAdvanceRequestSchema = z
  .object({
    orderText: z.string().trim().max(4_000).optional(),
    horizon: z.discriminatedUnion("mode", [
      z
        .object({
          mode: z.literal("days"),
          days: z.number().safe().int().min(7).max(365),
        })
        .strict(),
      z.object({ mode: z.literal("until_major_event") }).strict(),
    ]),
    provider: z.enum(["deterministic", "codex", "claude"]).optional(),
    expectedStateHash: z.string().regex(/^[a-f0-9]{64}$/),
    requestId: z.string().regex(/^req_[a-z0-9_]+$/),
  })
  .strict()
  .readonly();

const cadenceDays = Object.freeze({ week: 7, month: 30, quarter: 91, year: 365 });

const cadenceForHorizon = (
  horizon: AdvanceHorizon,
): "week" | "month" | "quarter" | "year" | "major" => {
  if (horizon.mode === "until_major_event") return "major";
  if (horizon.days === cadenceDays.week) return "week";
  if (horizon.days === cadenceDays.month) return "month";
  if (horizon.days === cadenceDays.year) return "year";
  return "quarter";
};

interface AdvanceInput {
  readonly orderText: string;
  readonly horizon: AdvanceHorizon;
  readonly cadence: "week" | "month" | "quarter" | "year" | "major";
  readonly provider?: ProviderSelection;
  readonly expectedStateHash: string;
  readonly requestId: string;
  readonly progression?:
    | { readonly mode: "months"; readonly months: number }
    | { readonly mode: "until_major_event" };
  readonly dateQuarterSteps?: number;
  readonly preserveTurn?: boolean;
  readonly promoteGeneratedEvent?: boolean;
}

const timelineAdvanceInput = (
  request: z.infer<typeof JumpTimelineRequestSchema>,
  campaign: CampaignState,
  expectedStateHash: string,
): AdvanceInput => {
  const base = {
    orderText: "",
    provider: campaign.plannerProvider,
    expectedStateHash,
    requestId: `req_timeline_${campaign.turn}_${expectedStateHash.slice(0, 16)}`,
    preserveTurn: true,
    promoteGeneratedEvent: true,
  } as const;
  if ("cadence" in request) {
    return request.cadence === "major"
      ? { ...base, horizon: { mode: "until_major_event" }, cadence: request.cadence }
      : {
          ...base,
          horizon: { mode: "days", days: cadenceDays[request.cadence] },
          cadence: request.cadence,
        };
  }
  if (request.progression.mode === "until_major_event") {
    return {
      ...base,
      horizon: { mode: "until_major_event" },
      cadence: "major",
      progression: request.progression,
    };
  }
  return {
    ...base,
    horizon: { mode: "days", days: request.progression.months * 30 },
    cadence: "month",
    progression: request.progression,
    dateQuarterSteps: Math.floor(request.progression.months / 3),
  };
};

const scenarioPackageBody = (request: Request): Promise<unknown> =>
  jsonBody(request, 1_000_000, "SCENARIO_PACKAGE_TOO_LARGE");

const scenarioReference = (scenarioId: string) => {
  const scenario = getScenarioById(scenarioId);
  return Object.freeze({
    id: scenario.id,
    revision: 1,
    canonicalHash: hashCanonical(scenario),
  });
};

const nonRecoverableErrorCodes = new Set([
  "provider_empty_output",
  "provider_malformed_output",
  "provider_output_too_large",
  "provider_plan_invalid",
  "provider_request_mismatch",
  "provider_schema_invalid",
]);

const errorBody = (code: string) => ({
  error: {
    code,
    recoverable: !nonRecoverableErrorCodes.has(code),
    messageKo: "요청을 처리할 수 없습니다.",
  },
});

type ApiErrorStatus = 400 | 404 | 409 | 413 | 422 | 500 | 503;
interface ApiError {
  readonly code: string;
  readonly status: ApiErrorStatus;
}

const rangeErrorResponse = (error: RangeError): ApiError => {
  if (error.message === "REQUEST_BODY_TOO_LARGE") {
    return { code: "request_body_too_large", status: 413 };
  }
  if (error.message === "IMPORT_TOO_LARGE") {
    return { code: "import_too_large", status: 413 };
  }
  if (error.message === "SCENARIO_PACKAGE_TOO_LARGE") {
    return { code: "scenario_package_too_large", status: 413 };
  }
  if (error.message === "SCENARIO_PACKAGE_HASH_MISMATCH") {
    return { code: "scenario_package_hash_mismatch", status: 422 };
  }
  if (
    [
      "SCENARIO_UNKNOWN_COUNTRY",
      "SCENARIO_DUPLICATE_NATION_ID",
      "SCENARIO_DUPLICATE_REGION_ID",
      "SCENARIO_INVALID_GEOMETRY",
      "SCENARIO_UNLICENSED_EXTERNAL_ASSET",
    ].includes(error.message)
  ) {
    return { code: error.message.toLowerCase(), status: 422 };
  }
  if (error.message.startsWith("Unknown scenario")) {
    return { code: "scenario_not_found", status: 404 };
  }
  if (error.message === "CAMPAIGN_NOT_STARTED") {
    return { code: "campaign_not_started", status: 409 };
  }
  if (error.message === "SLOT_NOT_FOUND") {
    return { code: "slot_not_found", status: 404 };
  }
  if (error.message === "ALLY_WAR_BLOCKED") {
    return { code: "ally_war_blocked", status: 409 };
  }
  return { code: "invalid_request", status: 400 };
};

const classifyApiError = (error: Error): ApiError => {
  if (error instanceof ProviderTurnError) {
    return { code: error.code, status: error.status };
  }
  if (error instanceof ZodError || error instanceof TypeError) {
    return { code: "invalid_request", status: 400 };
  }
  if (error instanceof RangeError) {
    return rangeErrorResponse(error);
  }
  return { code: "internal_error", status: 500 };
};

export const createGameApp = (options: GameAppOptions = {}): Hono => {
  const app = new Hono();
  const store = new LocalCampaignStore();
  const slotStore = createCampaignSlotStore({
    directory: options.slotDirectory ?? defaultSlotDirectory(),
    store,
  });
  const livePlanner =
    (provider: "codex" | "claude"): ProviderPlanner =>
    async (input) => {
      const campaign = store.read();
      const metadata = listBuiltInScenarioMetadata().find(
        (candidate) => candidate.id === campaign.scenarioId,
      );
      if (metadata === undefined) throw new RangeError("SCENARIO_METADATA_NOT_FOUND");
      return planWithLiveProvider({
        provider,
        requestId: input.requestId,
        orderText: input.orderText,
        stateJson: input.stateJson,
        nationCount: campaign.nations.length,
        scenario: {
          id: metadata.id,
          year: metadata.year,
          era: metadata.era,
          titleKo: metadata.titleKo,
          personaKo: metadata.personaKo,
          historicalBaselineKo: metadata.historicalBaselineKo,
        },
        ...(options.livePlannerRunner === undefined ? {} : { runner: options.livePlannerRunner }),
      });
    };
  const planners: Partial<Record<ProviderSelection, ProviderPlanner>> = {
    deterministic: async (input) => {
      const state = store.read();
      const playerProvinceId = state.provinces.find(
        (province) => province.ownerNationId === state.playerNationId,
      )?.id;
      return planDeterministically({
        ...input,
        playerNationId: state.playerNationId,
        ...(playerProvinceId === undefined ? {} : { playerProvinceId }),
        validNationIds: state.nations.map((nation) => nation.id),
        validProvinceIds: state.provinces.map((province) => province.id),
        npcActors: state.nations
          .filter((nation) => nation.id !== state.playerNationId)
          .flatMap((nation) => {
            const provinceId =
              state.provinces.find((province) => province.ownerNationId === nation.id)?.id ??
              state.provinces[0]?.id;
            return provinceId === undefined ? [] : [{ actorNationId: nation.id, provinceId }];
          }),
      });
    },
    codex: livePlanner("codex"),
    claude: livePlanner("claude"),
    ...options.planners,
  };
  const liveDiplomacyResponder =
    (provider: "codex" | "claude"): ProviderDiplomacyResponder =>
    async (input) => {
      const player = input.state.nations.find((nation) => nation.id === input.state.playerNationId);
      const target = input.state.nations.find((nation) => nation.id === input.targetNationId);
      return respondWithLiveDiplomacy({
        provider,
        playerNationName: player?.nameKo ?? input.state.playerNationId,
        targetNationName: target?.nameKo ?? input.targetNationId,
        roomParticipantNationNames: input.participantNationIds.map(
          (nationId) =>
            input.state.nations.find((nation) => nation.id === nationId)?.nameKo ?? nationId,
        ),
        playerMessage: input.message,
        decision: input.decision,
        stateJson: canonicalStringify(input.state),
      });
    };
  const diplomacyResponders: Partial<Record<ProviderSelection, ProviderDiplomacyResponder>> = {
    deterministic: async (input) =>
      deterministicCounterpartReply({
        state: input.state,
        targetNationId: input.targetNationId,
        decision: input.decision,
      }),
    codex: liveDiplomacyResponder("codex"),
    claude: liveDiplomacyResponder("claude"),
    ...options.diplomacyResponders,
  };
  const liveNewsAuthor =
    (provider: "codex" | "claude"): CampaignNewsAuthor =>
    (input) =>
      authorLiveNews({
        provider,
        orderText: input.orderText,
        contextJson: input.contextJson,
      });
  const newsAuthors: Partial<Record<ProviderSelection, CampaignNewsAuthor>> = {
    deterministic: async (input: CampaignNewsAuthorInput) => input.deterministicArticle,
    codex: liveNewsAuthor("codex"),
    claude: liveNewsAuthor("claude"),
    ...options.newsAuthors,
  };
  const liveReactionAuthor =
    (provider: "codex" | "claude"): CampaignReactionAuthor =>
    async (input) => {
      const output = await authorLiveReactionsBatch({
        provider,
        eventJson: input.eventJson,
        contextJson: input.contextJson,
        nations: input.nations,
      });
      return output.reactions;
    };
  const reactionAuthors: Partial<Record<ProviderSelection, CampaignReactionAuthor>> = {
    deterministic: async (input: CampaignReactionAuthorInput) =>
      input.nations.map((nation) => ({
        nationId: nation.id,
        stance: "neutral",
        sentimentBps: 0,
        statementKo: `${nation.nameKo} 정부는 사건의 영향을 검토하고 후속 입장을 정리한다.`,
      })),
    codex: liveReactionAuthor("codex"),
    claude: liveReactionAuthor("claude"),
    ...options.reactionAuthors,
  };
  const worldEventFactory = options.worldEventFactory ?? createCampaignWorldEvent;

  const advance = async (request: AdvanceInput) => {
    const campaign = parseCampaignState(store.read());
    if (store.stateHash() !== request.expectedStateHash) {
      throw new ProviderTurnError(409, "campaign_conflict");
    }
    const provider = request.provider ?? campaign.plannerProvider;
    const planner = planners[provider];
    const newsAuthor = newsAuthors[provider];
    const reactionAuthor = reactionAuthors[provider];
    if (planner === undefined || newsAuthor === undefined || reactionAuthor === undefined) {
      throw new ProviderTurnError(503, "provider_unavailable");
    }
    const timeOnly = request.orderText.trim().length === 0;
    const transactionStore = request.preserveTurn
      ? {
          read: () => {
            const state = store.read();
            return Object.freeze({ ...state, turn: state.turn - 1 });
          },
          replace: (state: Parameters<typeof store.replace>[0]) => store.replace(state),
        }
      : store;
    const result = await executeProviderTurn({
      store: transactionStore,
      requestId: request.requestId,
      plan: async () => {
        const plan = await planner({
          requestId: request.requestId,
          orderText: request.orderText,
          turn: campaign.turn,
          stateJson: buildPlannerStateJson(campaign),
        });
        const grounded = groundStrategicPlan({
          plan,
          orderText: request.orderText,
          playerNationId: campaign.playerNationId,
          playerProvinceIds: campaign.provinces
            .filter((province) => province.ownerNationId === campaign.playerNationId)
            .map((province) => province.id),
        });
        return timeOnly
          ? Object.freeze({ ...grounded, playerIntents: Object.freeze([]) })
          : grounded;
      },
      prepare: async (snapshot, plan) => {
        const before = request.preserveTurn ? campaign : parseCampaignState(snapshot);
        const progressed = advanceCampaignTimelineProgression({
          state: before,
          plan,
          orderText: request.orderText,
          horizon: request.horizon,
          cadence: request.cadence,
          eventFactory: worldEventFactory,
          ...(request.progression === undefined ? {} : { progression: request.progression }),
          ...(request.dateQuarterSteps === undefined
            ? {}
            : { dateQuarterSteps: request.dateQuarterSteps }),
          ...(request.promoteGeneratedEvent === undefined
            ? {}
            : { promoteGeneratedEvent: request.promoteGeneratedEvent }),
        });
        return finalizeCampaignTurn({
          before,
          reduced: progressed.state,
          plan,
          orderText: request.orderText,
          events: progressed.events,
          reactionAuthor,
          newsAuthor,
        });
      },
    });
    let autosave: TurnAutosaveStatus;
    try {
      await autosaveAfterTurn(slotStore);
      autosave = Object.freeze({ status: "saved", slot: "autosave" });
    } catch {
      autosave = failedAutosaveStatus;
    }
    return Object.freeze({ ...result, autosave });
  };

  app.use(
    "/api/*",
    cors({
      origin: [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
      ],
      allowHeaders: ["content-type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      exposeHeaders: ["x-pax-autosave"],
    }),
  );

  app.onError((error, context) => {
    const classified = classifyApiError(error);
    return context.json(errorBody(classified.code), classified.status);
  });

  app.post("/api/campaigns", async (context) => {
    const request = CreateCampaignRequestSchema.parse(await jsonBody(context.req.raw));
    const scenario = await loadScenarioById(request.scenarioId);
    const campaign = createCampaignStateFromScenario(scenario, request.playerNationId, {
      ...(request.customPolityName === undefined
        ? {}
        : { customPolityName: request.customPolityName }),
      ...(request.difficulty === undefined ? {} : { difficulty: request.difficulty }),
      plannerProvider: request.provider,
    });
    store.replace(campaign);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() }, 201);
  });

  app.get("/api/campaigns", async (context) => context.json({ slots: await slotStore.list() }));

  app.post("/api/campaigns/:slot/save", async (context) =>
    context.json(await slotStore.save(context.req.param("slot")), 201),
  );

  app.post("/api/campaigns/:slot/load", async (context) => {
    await slotStore.load(context.req.param("slot"));
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  app.get("/api/campaign", (context) =>
    context.json({ campaign: store.read(), stateHash: store.stateHash() }),
  );

  app.get("/api/campaign/state-hash", (context) => context.json({ stateHash: store.stateHash() }));

  app.post("/api/timeline/jump", async (context) => {
    const request = JumpTimelineRequestSchema.parse(await jsonBody(context.req.raw));
    const campaign = parseCampaignState(store.read());
    const expectedStateHash = store.stateHash();
    const result = await advance(timelineAdvanceInput(request, campaign, expectedStateHash));
    setTurnAutosaveHeader(context, result.autosave);
    return context.json({ campaign: result.state, stateHash: result.stateHash });
  });

  app.post("/api/diplomacy/chat", async (context) => {
    const request = DiplomacyChatRequestSchema.parse(await jsonBody(context.req.raw));
    const campaign = parseCampaignState(store.read());
    const responder = diplomacyResponders[request.provider ?? campaign.plannerProvider];
    if (responder === undefined) {
      throw new ProviderTurnError(503, "provider_unavailable");
    }
    let state: CampaignState;
    try {
      state = await executeCampaignGroupChat({
        state: campaign,
        targetNationIds: request.targetNationIds,
        message: request.message,
        responder,
      });
    } catch (error: unknown) {
      if (error instanceof RangeError) {
        throw error;
      }
      if (error instanceof ProviderTurnError) {
        throw error;
      }
      throw new ProviderTurnError(503, "provider_unavailable");
    }
    store.replace(state);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  app.get("/api/catalog", (context) =>
    context.json({
      scenarios: listScenarios().map((scenario) => ({
        id: scenario.id,
        titleKo: scenario.titleKo,
        era:
          listBuiltInScenarioMetadata().find((metadata) => metadata.id === scenario.id)?.era ??
          "unknown",
        genre:
          listBuiltInScenarioMetadata().find((metadata) => metadata.id === scenario.id)?.genre ??
          "unknown",
        year: scenario.year,
        playerNationIds: scenario.playerNationIds,
        nations: scenario.nations.map((nation) => ({ id: nation.id, nameKo: nation.nameKo })),
      })),
      countries: listCanonicalCountries(),
    }),
  );

  app.post("/api/catalog/scenarios/import", async (context) => {
    const packageValue = validateScenarioPackage(await scenarioPackageBody(context.req.raw));
    return context.json(
      {
        imported: true,
        scenarioId: packageValue.id,
        canonicalHash: packageValue.canonicalHash,
      },
      201,
    );
  });

  app.post("/api/diplomacy/treaties", async (context) => {
    const request = ProposeTreatyRequestSchema.parse(await jsonBody(context.req.raw));
    const state = proposeCampaignTreaty(
      parseCampaignState(store.read()),
      request.targetNationId,
      request.clause,
    );
    store.replace(state);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  app.post("/api/diplomacy/wars", async (context) => {
    const request = DeclareWarRequestSchema.parse(await jsonBody(context.req.raw));
    const state = declareCampaignWar(parseCampaignState(store.read()), request.targetNationId);
    store.replace(state);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  app.post("/api/diplomacy/transfers", async (context) => {
    const request = TransferTerritoryRequestSchema.parse(await jsonBody(context.req.raw));
    const state = transferCampaignProvince(
      parseCampaignState(store.read()),
      request.targetNationId,
      request.provinceId,
    );
    store.replace(state);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  app.post("/api/military/recruit", async (context) => {
    const request = RecruitUnitRequestSchema.parse(await jsonBody(context.req.raw));
    const state = recruitCampaignUnit(parseCampaignState(store.read()), request.provinceId);
    store.replace(state);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  app.post("/api/military/move", async (context) => {
    const request = MoveUnitRequestSchema.parse(await jsonBody(context.req.raw));
    const state = moveCampaignUnit(
      parseCampaignState(store.read()),
      request.unitId,
      request.provinceId,
    );
    store.replace(state);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  app.post("/api/military/combat", (context) => {
    const state = resolveCampaignCombat(parseCampaignState(store.read()));
    store.replace(state);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  app.post("/api/turns/advance", async (context) => {
    const request = TurnAdvanceRequestSchema.parse(await jsonBody(context.req.raw));
    const orderText = request.orderText ?? "";
    const result = await advance({
      orderText,
      horizon: request.horizon,
      cadence: cadenceForHorizon(request.horizon),
      ...(request.provider === undefined ? {} : { provider: request.provider }),
      expectedStateHash: request.expectedStateHash,
      requestId: request.requestId,
    });
    setTurnAutosaveHeader(context, result.autosave);
    return context.json({
      campaign: result.state,
      plan: strategicPlanCore(result.plan),
      stateHash: result.stateHash,
    });
  });

  app.post("/api/turns/preview", async (context) => {
    const request = AdvanceTurnRequestSchema.parse(await jsonBody(context.req.raw));
    const horizon: AdvanceHorizon =
      request.cadence === "major"
        ? { mode: "until_major_event" }
        : { mode: "days", days: cadenceDays[request.cadence] };
    const result = await advance({
      orderText: request.orderText,
      horizon,
      cadence: request.cadence,
      provider: request.provider,
      expectedStateHash: store.stateHash(),
      requestId: request.requestId,
      ...(request.cadence === "major"
        ? { progression: { mode: "until_major_event" as const } }
        : {}),
    });
    setTurnAutosaveHeader(context, result.autosave);
    return context.json({
      campaign: result.state,
      plan: strategicPlanCore(result.plan),
      stateHash: result.stateHash,
    });
  });

  app.get("/api/campaign/export", (context) => {
    const campaign = store.read();
    const serialized = serializeCampaignExport({
      scenario: scenarioReference(campaign.scenarioId),
      state: campaign,
    });
    return context.json(JSON.parse(serialized));
  });

  app.post("/api/campaign/import", async (context) => {
    const body = await jsonBody(context.req.raw, MAX_CAMPAIGN_IMPORT_BYTES, "IMPORT_TOO_LARGE");
    replaceCampaignFromExport(body, store);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  return app;
};
