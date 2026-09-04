import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import { createGameApp, type ProviderPlanInput } from "../../src/api/app";

const directories: string[] = [];

const createCampaign = async (app: ReturnType<typeof createGameApp>) => {
  const response = await app.request("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId: "scn_ea1900", playerNationId: "nat_kor" }),
  });
  expect(response.status).toBe(201);
  return z.object({ stateHash: z.string().length(64) }).parse(await response.json());
};

const timeOnlyPlan = (input: ProviderPlanInput) => ({
  schemaVersion: 2 as const,
  requestId: input.requestId,
  playerIntents: [],
  npcIntents: [
    {
      type: "action.fail" as const,
      actorNationId: "nat_jpn",
      attemptKo: "정책 유지",
      stabilityDelta: 0,
    },
  ],
  narrative: { ko: "세계는 각국의 기존 정책에 따라 움직였다." },
  warnings: [],
});

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "pax-turn-advance-"));
  directories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("turn advance API", () => {
  test("rejects an NPC actor spoof without committing earlier intent effects", async () => {
    // Given
    const app = createGameApp({
      slotDirectory: await temporaryDirectory(),
      planners: {
        deterministic: async (input) => ({
          schemaVersion: 2,
          requestId: input.requestId,
          playerIntents: [],
          npcIntents: [
            {
              type: "nation.adjust" as const,
              nationId: "nat_kor",
              treasuryDelta: -10,
              reasonKo: "선행 NPC 손실",
            },
            {
              type: "economy.invest" as const,
              actorNationId: "nat_kor",
              provinceId: "prv_kor_hanseong",
              sector: "rail",
              budgetCredits: 20,
            },
          ],
          narrative: { ko: "위조된 NPC 계획이다." },
          warnings: [],
        }),
      },
      worldEventFactory: () => undefined,
    });
    const created = await createCampaign(app);

    // When
    const response = await app.request("/api/turns/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderText: "정세를 관망한다",
        horizon: { mode: "days", days: 7 },
        expectedStateHash: created.stateHash,
        requestId: "req_npc_actor_spoof",
      }),
    });
    const after = z
      .object({ stateHash: z.string().length(64) })
      .parse(await (await app.request("/api/campaign/state-hash")).json());

    // Then
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "provider_plan_invalid", recoverable: false },
    });
    expect(after.stateHash).toBe(created.stateHash);
  });

  test("advances a time-only 90-day turn once and records deterministic tick deltas", async () => {
    // Given
    const plannerOrders: string[] = [];
    const slotDirectory = await temporaryDirectory();
    const app = createGameApp({
      slotDirectory,
      planners: {
        deterministic: async (input) => {
          plannerOrders.push(input.orderText);
          return timeOnlyPlan(input);
        },
      },
    });
    const created = await createCampaign(app);

    // When
    const response = await app.request("/api/turns/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        horizon: { mode: "days", days: 90 },
        expectedStateHash: created.stateHash,
        requestId: "req_advance_days_90",
      }),
    });

    // Then
    const responseBody: unknown = await response.json();
    expect(response.status, JSON.stringify(responseBody)).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          turn: z.literal(1),
          elapsedDays: z.number().int(),
          lastPlan: z.object({ playerIntents: z.array(z.unknown()).length(0) }),
          resolutions: z
            .array(
              z.object({
                nationDeltas: z.array(
                  z.object({
                    treasuryCredits: z.object({ source: z.enum(["policy", "tick"]) }),
                  }),
                ),
              }),
            )
            .length(1),
        }),
        plan: z.object({ playerIntents: z.array(z.unknown()).length(0) }),
        stateHash: z.string().length(64),
      })
      .parse(responseBody);
    expect(JSON.parse(response.headers.get("x-pax-autosave") ?? "null")).toEqual({
      status: "saved",
      slot: "autosave",
    });
    expect(plannerOrders).toEqual([""]);
    expect(body.campaign.elapsedDays).toBe(90);
    expect(
      body.campaign.resolutions[0]?.nationDeltas.some(
        (delta) => delta.treasuryCredits.source === "tick",
      ),
    ).toBe(true);
    expect(
      z
        .object({ header: z.object({ savedAtTurn: z.literal(1), stateHash: z.string() }) })
        .parse(JSON.parse(await readFile(join(slotDirectory, "autosave.json"), "utf8"))).header
        .stateHash,
    ).toBe(body.stateHash);
  });

  test("returns the committed turn with a recoverable status when autosave fails", async () => {
    // Given
    const directory = await temporaryDirectory();
    const blocker = join(directory, "not-a-directory");
    const slotDirectory = join(blocker, "slots");
    await writeFile(blocker, "blocked", "utf8");
    const app = createGameApp({
      slotDirectory,
      planners: { deterministic: async (input) => timeOnlyPlan(input) },
    });
    const created = await createCampaign(app);

    // When
    const response = await app.request("/api/turns/advance", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:5173" },
      body: JSON.stringify({
        horizon: { mode: "days", days: 90 },
        expectedStateHash: created.stateHash,
        requestId: "req_autosave_failure",
      }),
    });
    const responseBody: unknown = await response.json();
    const body = z
      .object({
        campaign: z.object({ turn: z.literal(1) }),
        stateHash: z.string().length(64),
      })
      .parse(responseBody);
    const autosave = z
      .object({
        status: z.literal("failed"),
        slot: z.literal("autosave"),
        error: z.object({ code: z.literal("autosave_failed"), recoverable: z.literal(true) }),
        retry: z.object({
          method: z.literal("POST"),
          path: z.literal("/api/campaigns/autosave/save"),
        }),
      })
      .parse(JSON.parse(response.headers.get("x-pax-autosave") ?? "null"));
    const current = await app.request("/api/campaign");

    // Then
    expect(response.status, JSON.stringify(responseBody)).toBe(200);
    expect(response.headers.get("access-control-expose-headers")).toBe("x-pax-autosave");
    expect(await current.json()).toMatchObject({
      campaign: { turn: 1 },
      stateHash: body.stateHash,
    });
    await rm(blocker);
    const retried = await app.request(autosave.retry.path, {
      method: autosave.retry.method,
    });
    expect(retried.status).toBe(201);
    expect(await retried.json()).toMatchObject({
      slot: "autosave",
      savedAtTurn: 1,
      stateHash: body.stateHash,
    });
  });

  test("rejects a stale state hash before invoking the planner", async () => {
    // Given
    let plannerCalls = 0;
    const app = createGameApp({
      slotDirectory: await temporaryDirectory(),
      planners: {
        deterministic: async (input) => {
          plannerCalls += 1;
          return timeOnlyPlan(input);
        },
      },
    });
    await createCampaign(app);

    // When
    const response = await app.request("/api/turns/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        horizon: { mode: "days", days: 90 },
        expectedStateHash: "0".repeat(64),
        requestId: "req_advance_stale_hash",
      }),
    });

    // Then
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "campaign_conflict" } });
    expect(plannerCalls).toBe(0);
  });

  test("stops an until-major horizon at the first generated major event", async () => {
    // Given
    let eventCalls = 0;
    const app = createGameApp({
      slotDirectory: await temporaryDirectory(),
      planners: { deterministic: async (input) => timeOnlyPlan(input) },
      worldEventFactory: ({ reduced }) => {
        eventCalls += 1;
        return eventCalls < 3
          ? null
          : {
              id: "evt_first_major",
              kind: "political",
              importance: "major",
              occurredAtElapsedDays: reduced.elapsedDays,
              turn: 1,
              date: reduced.date,
              actorNationIds: ["nat_kor"],
              affectedNationIds: ["nat_kor"],
              headlineKo: "중대 정치 사건",
              summaryKo: "세 번째 진행 단계에서 중대 사건이 발생했다.",
              impacts: {},
              provenance: "simulated_consequence",
              regionIds: [],
              sourceInputIds: ["req_advance_until_major"],
            };
      },
    });
    const created = await createCampaign(app);

    // When
    const response = await app.request("/api/turns/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        horizon: { mode: "until_major_event" },
        expectedStateHash: created.stateHash,
        requestId: "req_advance_until_major",
      }),
    });

    // Then
    expect(response.status).toBe(200);
    const campaign = z
      .object({
        campaign: z.object({
          elapsedDays: z.literal(90),
          lastProgression: z.object({
            steps: z.literal(3),
            stopReason: z.literal("major_event"),
            majorEventId: z.literal("evt_first_major"),
          }),
        }),
      })
      .parse(await response.json()).campaign;
    expect(campaign.lastProgression.stopReason).toBe("major_event");
    expect(eventCalls).toBe(3);
  });

  test("sorts and sequentially applies generated event impacts", async () => {
    // Given
    const transfer = (id: string, occurredAtElapsedDays: number, toNationId: string) => ({
      id,
      kind: "military" as const,
      importance: "minor" as const,
      occurredAtElapsedDays,
      turn: 1,
      date: { year: 1900, quarter: 1 },
      actorNationIds: [toNationId],
      affectedNationIds: ["nat_kor", "nat_jpn", "nat_qing"],
      headlineKo: `${occurredAtElapsedDays}일 영토 이전`,
      summaryKo: `${toNationId}이 지역을 점령했다.`,
      impacts: {
        regionTransfers: [
          {
            regionId: "prv_kor_hanseong",
            toNationId,
          },
        ],
        nationChanges: [],
        relationChanges: [],
        unitOps: [],
      },
      provenance: "simulated_consequence" as const,
      regionIds: ["prv_kor_hanseong"],
      sourceInputIds: ["req_advance_impacts"],
    });
    const app = createGameApp({
      slotDirectory: await temporaryDirectory(),
      planners: { deterministic: async (input) => timeOnlyPlan(input) },
      worldEventFactory: () => [
        transfer("evt_second_transfer", 20, "nat_qing"),
        transfer("evt_first_transfer", 10, "nat_jpn"),
      ],
    });
    const created = await createCampaign(app);

    // When
    const response = await app.request("/api/turns/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        horizon: { mode: "days", days: 30 },
        expectedStateHash: created.stateHash,
        requestId: "req_advance_impacts",
      }),
    });

    // Then
    expect(response.status).toBe(200);
    const campaign = z
      .object({
        campaign: z.object({
          provinces: z.array(z.object({ id: z.string(), ownerNationId: z.string() })),
          worldEvents: z.array(
            z.object({
              id: z.string(),
              impacts: z.object({
                regionTransfers: z.array(
                  z.object({
                    fromNationId: z.string(),
                    toNationId: z.string(),
                    sourceEventId: z.string(),
                  }),
                ),
              }),
            }),
          ),
        }),
      })
      .parse(await response.json()).campaign;
    expect(campaign.worldEvents.map((event) => event.id)).toEqual([
      "evt_first_transfer",
      "evt_second_transfer",
    ]);
    expect(
      campaign.provinces.find((province) => province.id === "prv_kor_hanseong")?.ownerNationId,
    ).toBe("nat_qing");
    expect(
      campaign.worldEvents.map((event) => event.impacts.regionTransfers[0]?.fromNationId),
    ).toEqual(["nat_kor", "nat_jpn"]);
    expect(
      campaign.worldEvents.map((event) => event.impacts.regionTransfers[0]?.sourceEventId),
    ).toEqual(["evt_first_transfer", "evt_second_transfer"]);
  });

  test("commits only one concurrent duplicate request", async () => {
    // Given
    const app = createGameApp({
      slotDirectory: await temporaryDirectory(),
      planners: { deterministic: async (input) => timeOnlyPlan(input) },
    });
    const created = await createCampaign(app);
    const request = () =>
      app.request("/api/turns/advance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          horizon: { mode: "days", days: 90 },
          expectedStateHash: created.stateHash,
          requestId: "req_advance_duplicate",
        }),
      });

    // When
    const responses = await Promise.all([request(), request()]);
    const current = await app.request("/api/campaign");

    // Then
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(
      z.object({ campaign: z.object({ turn: z.literal(1) }) }).parse(await current.json()),
    ).toBeDefined();
  });
});
