import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";

import { applyStrategicPlan } from "../application/apply-strategic-plan";
import { deterministicCounterpartReply } from "../application/campaign-chat";
import {
  type CampaignGroupChatResponder,
  type CampaignGroupChatResponderInput,
  executeCampaignGroupChat,
} from "../application/campaign-group-chat";
import {
  type CampaignState,
  createCampaignState,
  jumpCampaignTimeline,
  LocalCampaignStore,
  parseCampaignState,
} from "../application/campaign-state";
import { executeProviderTurn, ProviderTurnError } from "../application/turn-transaction";
import {
  declareCampaignWar,
  moveCampaignUnit,
  proposeCampaignTreaty,
  recruitCampaignUnit,
  resolveCampaignCombat,
  transferCampaignProvince,
} from "../application/warfare-actions";
import { listBuiltInScenarioMetadata, listCanonicalCountries } from "../domain/scenario/catalog";
import { validateScenarioPackage } from "../domain/scenario/package";
import { getScenarioById, listScenarios } from "../domain/scenario/registry";
import { importCampaignExport, serializeCampaignExport } from "../persistence/export-import";
import { planDeterministically } from "../providers/deterministic-provider";
import { respondWithLiveDiplomacy } from "../providers/live-diplomacy";
import { planWithLiveProvider } from "../providers/live-planner";
import type { StrategicPlan } from "../providers/schemas";
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
}

const jsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    throw new TypeError("INVALID_JSON_BODY");
  }
};

const scenarioPackageBody = async (request: Request): Promise<unknown> => {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 1_000_000) {
    throw new RangeError("SCENARIO_PACKAGE_TOO_LARGE");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new TypeError("INVALID_JSON_BODY");
  }
};

const scenarioReference = (scenarioId: string) => {
  const scenario = getScenarioById(scenarioId);
  return Object.freeze({
    id: scenario.id,
    revision: 1,
    canonicalHash: hashCanonical(scenario),
  });
};

const errorBody = (code: string) => ({
  error: { code, recoverable: true, messageKo: "요청을 처리할 수 없습니다." },
});

type ApiErrorStatus = 400 | 404 | 409 | 413 | 422 | 500 | 503;
interface ApiError {
  readonly code: string;
  readonly status: ApiErrorStatus;
}

const rangeErrorResponse = (error: RangeError): ApiError => {
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
    codex: async (input) =>
      planWithLiveProvider({
        provider: "codex",
        requestId: input.requestId,
        orderText: input.orderText,
        stateJson: input.stateJson,
      }),
    claude: async (input) =>
      planWithLiveProvider({
        provider: "claude",
        requestId: input.requestId,
        orderText: input.orderText,
        stateJson: input.stateJson,
      }),
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

  app.use(
    "/api/*",
    cors({
      origin: ["http://127.0.0.1:5173", "http://localhost:5173"],
      allowHeaders: ["content-type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.onError((error, context) => {
    const classified = classifyApiError(error);
    return context.json(errorBody(classified.code), classified.status);
  });

  app.post("/api/campaigns", async (context) => {
    const request = CreateCampaignRequestSchema.parse(await jsonBody(context.req.raw));
    const campaign = createCampaignState(request.scenarioId, request.playerNationId, {
      ...(request.customPolityName === undefined
        ? {}
        : { customPolityName: request.customPolityName }),
      ...(request.difficulty === undefined ? {} : { difficulty: request.difficulty }),
      plannerProvider: request.provider,
    });
    store.replace(campaign);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() }, 201);
  });

  app.get("/api/campaign", (context) =>
    context.json({ campaign: store.read(), stateHash: store.stateHash() }),
  );

  app.get("/api/campaign/state-hash", (context) => context.json({ stateHash: store.stateHash() }));

  app.post("/api/timeline/jump", async (context) => {
    const request = JumpTimelineRequestSchema.parse(await jsonBody(context.req.raw));
    const state = jumpCampaignTimeline(parseCampaignState(store.read()), request.cadence);
    store.replace(state);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  app.post("/api/diplomacy/chat", async (context) => {
    const request = DiplomacyChatRequestSchema.parse(await jsonBody(context.req.raw));
    const campaign = parseCampaignState(store.read());
    const responder = diplomacyResponders[request.provider];
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

  app.post("/api/turns/preview", async (context) => {
    const request = AdvanceTurnRequestSchema.parse(await jsonBody(context.req.raw));
    const planner = planners[request.provider];
    if (planner === undefined) {
      throw new ProviderTurnError(503, "provider_unavailable");
    }
    const result = await executeProviderTurn({
      store,
      requestId: request.requestId,
      plan: async () =>
        planner({
          requestId: request.requestId,
          orderText: request.orderText,
          turn: store.read().turn,
          stateJson: canonicalStringify(store.read()),
        }),
      reduce: (snapshot, plan) =>
        applyStrategicPlan({
          snapshot: parseCampaignState(snapshot),
          plan,
          orderText: request.orderText,
          cadence: request.cadence,
        }),
    });
    return context.json({ campaign: result.state, plan: result.plan, stateHash: result.stateHash });
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
    const body = await jsonBody(context.req.raw);
    const scenarioId = zodScenarioId(body);
    const imported = importCampaignExport({
      json: JSON.stringify(body),
      expectedScenario: scenarioReference(scenarioId),
    });
    const campaign = parseCampaignState(imported.state);
    if (campaign.scenarioId !== imported.scenario.id) {
      throw new RangeError("SCENARIO_STATE_MISMATCH");
    }
    store.replace(campaign);
    return context.json({ campaign: store.read(), stateHash: store.stateHash() });
  });

  return app;
};

const zodScenarioId = (value: unknown): string => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("scenario" in value) ||
    typeof value.scenario !== "object" ||
    value.scenario === null ||
    !("id" in value.scenario) ||
    typeof value.scenario.id !== "string"
  ) {
    throw new TypeError("INVALID_CAMPAIGN_EXPORT");
  }
  return value.scenario.id;
};
