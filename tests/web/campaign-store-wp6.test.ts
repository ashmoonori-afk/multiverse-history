import { afterEach, describe, expect, test } from "bun:test";

import { createCampaignState } from "../../src/application/campaign-state";
import {
  type Campaign,
  type CampaignStoreState,
  useCampaignStore,
} from "../../web/src/state/campaign-store";

const originalFetch = globalThis.fetch;
const stateHash = "a".repeat(64);
const nextStateHash = "b".repeat(64);
const campaign = createCampaignState("scn_ea1900", "nat_kor") as unknown as Campaign;
const plan = {
  schemaVersion: 2 as const,
  requestId: "req_web_test",
  playerIntents: [],
  npcIntents: [],
  narrative: { ko: "시간이 흘렀다." },
  warnings: [],
};

interface SlotSummary {
  readonly slot: string;
  readonly savedAtTurn: number;
  readonly elapsedDays: number;
  readonly scenarioId: string;
  readonly playerNationId: string;
  readonly stateHash: string;
}

interface SlotActions {
  readonly slots: readonly SlotSummary[];
  readonly slotsBusy: boolean;
  readonly loadSlots: () => Promise<boolean>;
  readonly saveSlot: (slot: string) => Promise<boolean>;
  readonly loadSlot: (slot: string) => Promise<boolean>;
}

const store = (): CampaignStoreState & SlotActions =>
  useCampaignStore.getState() as CampaignStoreState & SlotActions;

const response = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const setCampaign = (): void => {
  useCampaignStore.setState({
    campaign,
    bootstrapReady: true,
    startScreenRequested: false,
    stateHash,
    plan: null,
    busy: false,
    error: null,
    saveStatus: null,
    provider: "deterministic",
  });
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  useCampaignStore.setState({
    campaign: null,
    bootstrapReady: false,
    startScreenRequested: false,
    stateHash: null,
    plan: null,
    busy: false,
    error: null,
    saveStatus: null,
    provider: "codex",
  });
});

describe("WP6 campaign store", () => {
  test("posts the exact one-year advance contract", async () => {
    // Given
    setCampaign();
    let path = "";
    let requestBody: unknown;
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        path = String(input);
        requestBody = JSON.parse(String(init?.body));
        const requestId = (requestBody as { requestId: string }).requestId;
        return response({ campaign, stateHash: nextStateHash, plan: { ...plan, requestId } });
      },
      { preconnect: originalFetch.preconnect },
    );

    // When
    const advanced = await store().advanceTurn("제주에 공항을 건설한다", "year");

    // Then
    expect(advanced).toBe(true);
    expect(path).toBe("/api/turns/advance");
    expect(requestBody).toEqual({
      orderText: "제주에 공항을 건설한다",
      horizon: { mode: "days", days: 365 },
      provider: "deterministic",
      expectedStateHash: stateHash,
      requestId: expect.stringMatching(/^req_web_[a-z0-9]+$/),
    });
  });

  test("posts the major-event horizon and refuses a missing state hash locally", async () => {
    // Given
    setCampaign();
    const bodies: unknown[] = [];
    globalThis.fetch = Object.assign(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        bodies.push(body);
        const requestId = (body as { requestId: string }).requestId;
        return response({ campaign, stateHash: nextStateHash, plan: { ...plan, requestId } });
      },
      { preconnect: originalFetch.preconnect },
    );

    // When
    const advanced = await store().advanceTurn("중대 사건을 기다린다", "major");
    useCampaignStore.setState({ stateHash: null });
    const refused = await store().advanceTurn("다시 진행한다", "week");

    // Then
    expect(advanced).toBe(true);
    expect(bodies[0]).toEqual({
      orderText: "중대 사건을 기다린다",
      horizon: { mode: "until_major_event" },
      provider: "deterministic",
      expectedStateHash: stateHash,
      requestId: expect.stringMatching(/^req_web_[a-z0-9]+$/),
    });
    expect(refused).toBe(false);
    expect(bodies).toHaveLength(1);
    expect(store().error).toContain("상태");
  });

  test("lists and saves slots in store state", async () => {
    // Given
    setCampaign();
    const slot: SlotSummary = {
      slot: "year-one",
      savedAtTurn: 1,
      elapsedDays: 365,
      scenarioId: "scn_ea1900",
      playerNationId: "nat_kor",
      stateHash,
    };
    const requests: string[] = [];
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL) => {
        const path = String(input);
        requests.push(path);
        return path === "/api/campaigns" ? response({ slots: [] }) : response(slot, 201);
      },
      { preconnect: originalFetch.preconnect },
    );

    // When
    const listed = await store().loadSlots();
    const saved = await store().saveSlot("year-one");

    // Then
    expect(listed).toBe(true);
    expect(saved).toBe(true);
    expect(requests).toEqual(["/api/campaigns", "/api/campaigns/year-one/save"]);
    expect(store().slots).toEqual([slot]);
    expect(store().slotsBusy).toBe(false);
    expect(store().saveStatus).toContain("year-one");
  });

  test("loads a slot, clears stale turn state, and reports slot errors", async () => {
    // Given
    setCampaign();
    useCampaignStore.setState({ plan, error: "이전 오류", saveStatus: "이전 상태" });
    const loadedCampaign = { ...campaign, turn: 4, plannerProvider: "deterministic" as const };
    let shouldFail = false;
    globalThis.fetch = Object.assign(
      async () =>
        shouldFail
          ? response(
              {
                error: {
                  code: "slot_not_found",
                  recoverable: true,
                  messageKo: "저장 슬롯을 찾을 수 없습니다.",
                },
              },
              404,
            )
          : response({ campaign: loadedCampaign, stateHash: nextStateHash }),
      { preconnect: originalFetch.preconnect },
    );

    // When
    const loaded = await store().loadSlot("year-one");
    shouldFail = true;
    const failed = await store().loadSlot("missing");

    // Then
    expect(loaded).toBe(true);
    expect(store().campaign?.turn).toBe(4);
    expect(store().stateHash).toBe(nextStateHash);
    expect(store().plan).toBeNull();
    expect(store().provider).toBe("deterministic");
    expect(failed).toBe(false);
    expect(store().slotsBusy).toBe(false);
    expect(store().error).toBe("저장 슬롯을 찾을 수 없습니다.");
  });
});
