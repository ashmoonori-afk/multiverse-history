import { z } from "zod";
import { create } from "zustand";

const IntentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("economy.invest"),
      actorNationId: z.string(),
      provinceId: z.string(),
      sector: z.literal("rail"),
      budgetCredits: z.number().int(),
    })
    .strict(),
  z
    .object({
      type: z.literal("diplomacy.propose_treaty"),
      actorNationId: z.string(),
      recipientNationId: z.string(),
      clauses: z.array(z.literal("trade")),
    })
    .strict(),
  z
    .object({
      type: z.literal("military.recruit"),
      actorNationId: z.string(),
      provinceId: z.string(),
      manpower: z.number().int(),
    })
    .strict(),
]);

const StrategicPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: z.string(),
    playerIntents: z.array(IntentSchema),
    npcIntents: z.array(IntentSchema),
    narrative: z.object({ ko: z.string() }).strict(),
    warnings: z.array(z.string()),
  })
  .strict();

const NumericDeltaSchema = z
  .object({
    before: z.number().int(),
    after: z.number().int(),
  })
  .strict();

const CampaignResolutionSchema = z
  .object({
    id: z.string(),
    turn: z.number().int().nonnegative(),
    timestampKo: z.string().min(1),
    orderText: z.string().min(1),
    narrativeKo: z.string().min(1),
    nationDeltas: z.array(
      z
        .object({
          nationId: z.string(),
          nationNameKo: z.string().min(1),
          treasuryCredits: NumericDeltaSchema,
          gdpCredits: NumericDeltaSchema,
          infrastructureBps: NumericDeltaSchema,
        })
        .strict(),
    ),
    relationDeltas: z.array(
      z
        .object({
          fromNationId: z.string(),
          toNationId: z.string(),
          before: z.number().int(),
          after: z.number().int(),
        })
        .strict(),
    ),
    treatyDeltas: z.array(
      z
        .object({
          id: z.string(),
          proposerNationId: z.string(),
          recipientNationId: z.string(),
          clauses: z.array(z.string()),
          status: z.enum(["proposed", "active"]),
          proposedTurn: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    worldImpact: z
      .object({
        changedNationIds: z.array(z.string()),
        changedProvinceIds: z.array(z.string()),
        summaryKo: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const CampaignChatMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(["player", "counterpart"]),
    speakerNationId: z.string(),
    targetNationId: z.string(),
    turn: z.number().int().nonnegative(),
    date: z.object({ year: z.number().int(), quarter: z.number().int().min(1).max(4) }).strict(),
    text: z.string().min(1),
  })
  .strict();

const CampaignSchema = z
  .object({
    id: z.literal("cmp_local"),
    scenarioId: z.string(),
    playerNationId: z.string(),
    difficulty: z.enum(["story", "standard", "hard"]),
    elapsedDays: z.number().int().nonnegative(),
    turn: z.number().int().nonnegative(),
    date: z.object({ year: z.number().int(), quarter: z.number().int().min(1).max(4) }).strict(),
    nations: z.array(
      z
        .object({
          id: z.string(),
          nameKo: z.string(),
          capitalLabelKo: z.string().min(1),
          legalActions: z.array(z.string().min(1)),
          treasuryCredits: z.number().int().nonnegative(),
          gdpCredits: z.number().int().nonnegative(),
          taxRateBps: z.number().int().nonnegative(),
          stabilityBps: z.number().int().nonnegative(),
          population: z.number().int().nonnegative(),
          infrastructureBps: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    provinces: z.array(
      z
        .object({
          id: z.string(),
          ownerNationId: z.string(),
          population: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    relations: z.array(
      z
        .object({
          fromNationId: z.string(),
          toNationId: z.string(),
          value: z.number().int(),
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
          proposedTurn: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    units: z.array(
      z
        .object({
          id: z.string(),
          ownerNationId: z.string(),
          provinceId: z.string(),
          manpower: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    wars: z.array(
      z
        .object({
          attackerNationId: z.string(),
          targetNationId: z.string(),
          declaredTurn: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    battleReports: z.array(z.string()),
    events: z.array(z.string()),
    lastPlan: StrategicPlanSchema.nullable(),
    resolutions: z.array(CampaignResolutionSchema),
    chatMessages: z.array(CampaignChatMessageSchema),
  })
  .strict();

const CampaignResponseSchema = z
  .object({
    campaign: CampaignSchema,
    stateHash: z.string().length(64),
  })
  .strict();

const CampaignExportSchema = z
  .object({
    exportVersion: z.literal(1),
    exportedStateHash: z.string().length(64),
    scenario: z
      .object({
        id: z.string(),
        revision: z.number().int().positive(),
        canonicalHash: z.string().length(64),
      })
      .strict(),
    state: z.unknown(),
  })
  .strict();

const StateHashResponseSchema = z.object({ stateHash: z.string().length(64) }).strict();

const TurnResponseSchema = CampaignResponseSchema.extend({
  plan: StrategicPlanSchema,
}).strict();

const ApiErrorSchema = z
  .object({
    error: z.object({ code: z.string(), recoverable: z.boolean(), messageKo: z.string() }).strict(),
  })
  .strict();

export type Campaign = z.infer<typeof CampaignSchema>;
export type StrategicPlan = z.infer<typeof StrategicPlanSchema>;
export type CampaignResolution = z.infer<typeof CampaignResolutionSchema>;
export type CampaignChatMessage = z.infer<typeof CampaignChatMessageSchema>;
export type CampaignExport = z.infer<typeof CampaignExportSchema>;
export type TreatyClause = "alliance" | "non_aggression" | "trade" | "military_access";
export type PlannerProvider = "deterministic" | "codex" | "claude";
export type CampaignDifficulty = "story" | "standard" | "hard";
export type TimelineCadence = "week" | "month" | "quarter" | "year" | "major";
export interface CampaignCreationOptions {
  readonly customPolityName?: string;
  readonly difficulty?: CampaignDifficulty;
}

export class CampaignApiError extends Error {
  readonly code: string;

  constructor(code: string, messageKo: string) {
    super(messageKo);
    this.name = "CampaignApiError";
    this.code = code;
  }
}

const parseResponse = async <T>(response: Response, schema: z.ZodType<T>): Promise<T> => {
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    throw new CampaignApiError(
      parsed.success ? parsed.data.error.code : "invalid_response",
      parsed.success ? parsed.data.error.messageKo : "서버 응답을 해석할 수 없습니다.",
    );
  }
  return schema.parse(body);
};

const requestId = (): string => `req_web_${Date.now().toString(36)}`;
let campaignLoadEpoch = 0;
let newCampaignRequested = false;
const isCurrentCampaignLoad = (epoch: number): boolean =>
  epoch === campaignLoadEpoch && !newCampaignRequested;
const isCampaignNotStartedError = (error: unknown): boolean =>
  error instanceof CampaignApiError && error.code === "campaign_not_started";

export interface CampaignStoreState {
  readonly campaign: Campaign | null;
  readonly bootstrapReady: boolean;
  readonly startScreenRequested: boolean;
  readonly stateHash: string | null;
  readonly plan: StrategicPlan | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly saveStatus: string | null;
  readonly provider: PlannerProvider;
  readonly loadCampaign: () => Promise<void>;
  readonly beginNewCampaign: () => void;
  readonly createCampaign: (
    scenarioId: string,
    playerNationId: string,
    provider?: PlannerProvider,
    options?: CampaignCreationOptions,
  ) => Promise<boolean>;
  readonly advanceTurn: (orderText: string) => Promise<boolean>;
  readonly sendChat: (targetNationId: string, message: string) => Promise<boolean>;
  readonly jumpTimeline: (cadence: TimelineCadence) => Promise<boolean>;
  readonly saveCampaign: () => Promise<boolean>;
  readonly exportCampaign: () => Promise<string | null>;
  readonly importCampaign: (json: string) => Promise<boolean>;
  readonly proposeTreaty: (targetNationId: string, clause: TreatyClause) => Promise<boolean>;
  readonly transferTerritory: (targetNationId: string, provinceId: string) => Promise<boolean>;
  readonly declareWar: (targetNationId: string) => Promise<boolean>;
  readonly recruitUnit: (provinceId: string) => Promise<boolean>;
  readonly moveUnit: (unitId: string, provinceId: string) => Promise<boolean>;
  readonly resolveCombat: () => Promise<boolean>;
}

const messageForError = (error: unknown): string =>
  error instanceof CampaignApiError
    ? error.message
    : error instanceof z.ZodError
      ? "서버 응답의 형식이 올바르지 않습니다."
      : "네트워크 연결을 확인해 주세요.";

const postCampaignAction = async (
  path: string,
  body: Record<string, string>,
): Promise<z.infer<typeof CampaignResponseSchema>> =>
  parseResponse(
    await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    CampaignResponseSchema,
  );

export const useCampaignStore = create<CampaignStoreState>((set, get) => ({
  campaign: null,
  bootstrapReady: false,
  startScreenRequested: false,
  stateHash: null,
  plan: null,
  busy: false,
  error: null,
  saveStatus: null,
  provider: "deterministic",
  loadCampaign: async () => {
    const epoch = ++campaignLoadEpoch;
    try {
      const result = await parseResponse(await fetch("/api/campaign"), CampaignResponseSchema);
      if (!isCurrentCampaignLoad(epoch) || get().startScreenRequested) {
        return;
      }
      set({
        campaign: result.campaign,
        bootstrapReady: true,
        startScreenRequested: false,
        stateHash: result.stateHash,
        error: null,
        saveStatus: null,
        provider: "deterministic",
      });
    } catch (error: unknown) {
      if (!isCurrentCampaignLoad(epoch)) {
        return;
      }
      if (isCampaignNotStartedError(error)) {
        if (get().campaign === null) {
          set({
            campaign: null,
            bootstrapReady: true,
            stateHash: null,
            plan: null,
            error: null,
          });
        }
        return;
      }
      set({ bootstrapReady: true, error: messageForError(error) });
    }
  },
  beginNewCampaign: () => {
    newCampaignRequested = true;
    campaignLoadEpoch += 1;
    set({
      campaign: null,
      bootstrapReady: true,
      startScreenRequested: true,
      stateHash: null,
      plan: null,
      error: null,
      saveStatus: null,
      provider: "deterministic",
    });
  },
  createCampaign: async (scenarioId, playerNationId, provider = "deterministic", options = {}) => {
    newCampaignRequested = false;
    campaignLoadEpoch += 1;
    set({ busy: true, error: null });
    try {
      const result = await parseResponse(
        await fetch("/api/campaigns", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenarioId, playerNationId, ...options }),
        }),
        CampaignResponseSchema,
      );
      set({
        campaign: result.campaign,
        bootstrapReady: true,
        startScreenRequested: false,
        stateHash: result.stateHash,
        plan: null,
        busy: false,
        saveStatus: null,
        provider,
      });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error) });
      return false;
    }
  },
  advanceTurn: async (orderText) => {
    const campaign = get().campaign;
    if (campaign === null) {
      return false;
    }
    set({ busy: true, error: null, saveStatus: null });
    try {
      const result = await parseResponse(
        await fetch("/api/turns/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: get().provider,
            requestId: requestId(),
            orderText,
          }),
        }),
        TurnResponseSchema,
      );
      set({
        campaign: result.campaign,
        stateHash: result.stateHash,
        plan: result.plan,
        busy: false,
        saveStatus: null,
      });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error) });
      return false;
    }
  },
  sendChat: async (targetNationId, message) => {
    if (get().campaign === null) {
      return false;
    }
    set({ busy: true, error: null, saveStatus: null });
    try {
      const result = await parseResponse(
        await fetch("/api/diplomacy/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetNationId, message }),
        }),
        CampaignResponseSchema,
      );
      set({
        campaign: result.campaign,
        stateHash: result.stateHash,
        busy: false,
        saveStatus: null,
      });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error) });
      return false;
    }
  },
  jumpTimeline: async (cadence) => {
    set({ busy: true, error: null, saveStatus: null });
    try {
      const result = await postCampaignAction("/api/timeline/jump", { cadence });
      set({ campaign: result.campaign, stateHash: result.stateHash, busy: false });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error) });
      return false;
    }
  },
  saveCampaign: async () => {
    set({ error: null });
    try {
      const result = await parseResponse(
        await fetch("/api/campaign/state-hash"),
        StateHashResponseSchema,
      );
      set({ saveStatus: `저장됨 · ${result.stateHash.slice(0, 8)}` });
      return true;
    } catch (error: unknown) {
      set({ error: messageForError(error), saveStatus: null });
      return false;
    }
  },
  exportCampaign: async () => {
    set({ error: null });
    try {
      const result = await parseResponse(await fetch("/api/campaign/export"), CampaignExportSchema);
      set({ saveStatus: "내보냄" });
      return JSON.stringify(result);
    } catch (error: unknown) {
      set({ error: messageForError(error), saveStatus: null });
      return null;
    }
  },
  importCampaign: async (json) => {
    newCampaignRequested = false;
    set({ busy: true, error: null, saveStatus: null });
    try {
      const result = await parseResponse(
        await fetch("/api/campaign/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: json,
        }),
        CampaignResponseSchema,
      );
      set({
        campaign: result.campaign,
        startScreenRequested: false,
        stateHash: result.stateHash,
        plan: null,
        busy: false,
        saveStatus: "가져옴",
        provider: "deterministic",
      });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error), saveStatus: null });
      return false;
    }
  },
  proposeTreaty: async (targetNationId, clause) => {
    set({ busy: true, error: null, saveStatus: null });
    try {
      const result = await postCampaignAction("/api/diplomacy/treaties", {
        targetNationId,
        clause,
      });
      set({ campaign: result.campaign, stateHash: result.stateHash, busy: false });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error) });
      return false;
    }
  },
  transferTerritory: async (targetNationId, provinceId) => {
    set({ busy: true, error: null, saveStatus: null });
    try {
      const result = await postCampaignAction("/api/diplomacy/transfers", {
        targetNationId,
        provinceId,
      });
      set({ campaign: result.campaign, stateHash: result.stateHash, busy: false });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error) });
      return false;
    }
  },
  declareWar: async (targetNationId) => {
    set({ busy: true, error: null, saveStatus: null });
    try {
      const result = await postCampaignAction("/api/diplomacy/wars", { targetNationId });
      set({ campaign: result.campaign, stateHash: result.stateHash, busy: false });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error) });
      return false;
    }
  },
  recruitUnit: async (provinceId) => {
    set({ busy: true, error: null, saveStatus: null });
    try {
      const result = await postCampaignAction("/api/military/recruit", { provinceId });
      set({ campaign: result.campaign, stateHash: result.stateHash, busy: false });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error) });
      return false;
    }
  },
  moveUnit: async (unitId, provinceId) => {
    set({ busy: true, error: null, saveStatus: null });
    try {
      const result = await postCampaignAction("/api/military/move", { unitId, provinceId });
      set({ campaign: result.campaign, stateHash: result.stateHash, busy: false });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error) });
      return false;
    }
  },
  resolveCombat: async () => {
    set({ busy: true, error: null, saveStatus: null });
    try {
      const result = await postCampaignAction("/api/military/combat", {});
      set({ campaign: result.campaign, stateHash: result.stateHash, busy: false });
      return true;
    } catch (error: unknown) {
      set({ busy: false, error: messageForError(error) });
      return false;
    }
  },
}));
