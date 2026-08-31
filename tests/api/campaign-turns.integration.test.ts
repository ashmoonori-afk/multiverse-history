import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";
import { hashCanonical } from "../../src/shared/canonical-json";

const campaignId = "cmp_local";
const scenarioId = "scn_ea1900";
const playerNationId = "nat_kor";

const NationSchema = z.object({
  id: z.string(),
  treasuryCredits: z.number().int(),
  population: z.number().int(),
  infrastructureBps: z.number().int(),
});

const CampaignSchema = z.object({
  id: z.literal(campaignId),
  scenarioId: z.literal(scenarioId),
  playerNationId: z.literal(playerNationId),
  turn: z.number().int().nonnegative(),
  date: z.object({ year: z.number().int(), quarter: z.number().int().min(1).max(4) }),
  nations: z.array(NationSchema),
  provinces: z.array(z.object({ id: z.string(), ownerNationId: z.string() })),
  relations: z.array(
    z.object({
      fromNationId: z.string(),
      toNationId: z.string(),
      value: z.number().int(),
    }),
  ),
  treaties: z.array(z.unknown()),
  events: z.array(z.string()),
});

const CampaignResponseSchema = z.object({
  campaign: CampaignSchema,
  stateHash: z.string().regex(/^[a-f0-9]{64}$/),
});

const ProcessedArticleSchema = z
  .object({
    headlineKo: z.string().min(1),
    ledeKo: z.string().min(1),
    paragraphsKo: z.array(z.string().min(1)).min(2),
    quote: z
      .object({
        textKo: z.string().min(1),
        attributionKo: z.string().min(1),
      })
      .optional(),
  })
  .strict();

const createCampaign = async (app: ReturnType<typeof createGameApp>) => {
  const response = await app.request("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId, playerNationId }),
  });
  expect(response.status).toBe(201);
  return CampaignResponseSchema.parse(await response.json());
};

describe("campaign and turn API", () => {
  test("creates the 1900 Korean campaign and exposes its canonical hash", async () => {
    // Given
    const app = createGameApp();

    // When
    const created = await createCampaign(app);
    const hashResponse = await app.request("/api/campaign/state-hash");

    // Then
    const korea = created.campaign.nations.find((nation) => nation.id === playerNationId);
    expect(created.campaign).toMatchObject({
      turn: 0,
      date: { year: 1900, quarter: 1 },
      treaties: [],
      events: [],
    });
    expect(korea).toMatchObject({
      treasuryCredits: 240,
      population: 17_082_000,
      infrastructureBps: 2_400,
    });
    expect(
      created.campaign.provinces.some((province) => province.ownerNationId === playerNationId),
    ).toBe(true);
    expect(created.campaign.relations.length).toBeGreaterThan(0);
    expect(hashResponse.status).toBe(200);
    expect(await hashResponse.json()).toEqual({ stateHash: created.stateHash });
  });

  test("commits one deterministic rail and trade turn with NPC and chronicle results", async () => {
    // Given
    const app = createGameApp();
    const before = await createCampaign(app);
    const beforeKorea = before.campaign.nations.find((nation) => nation.id === playerNationId);

    // When
    const response = await app.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deterministic",
        requestId: "req_api_turn_0001",
        orderText: "철도망을 확장하고 일본에 통상 협정을 제안한다",
      }),
    });

    // Then
    expect(response.status).toBe(200);
    const advanced = CampaignResponseSchema.extend({
      plan: z.object({
        npcIntents: z.array(z.unknown()).min(1),
        narrative: z.object({ ko: z.string().min(1) }),
      }),
    }).parse(await response.json());
    const korea = advanced.campaign.nations.find((nation) => nation.id === playerNationId);
    expect(advanced.campaign.turn).toBe(1);
    expect(korea?.treasuryCredits).not.toBe(beforeKorea?.treasuryCredits);
    expect(korea?.infrastructureBps).toBeGreaterThan(beforeKorea?.infrastructureBps ?? 0);
    expect(
      advanced.campaign.treaties.some(
        (treaty) => z.object({ recipientNationId: z.literal("nat_jpn") }).safeParse(treaty).success,
      ),
    ).toBe(true);
    expect(advanced.campaign.events.some((event) => event.includes("철도망"))).toBe(true);
    expect(advanced.stateHash).not.toBe(before.stateHash);
  });

  test("exports and imports a progressed campaign without changing its canonical hash", async () => {
    // Given
    const source = createGameApp();
    await createCampaign(source);
    await source.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deterministic",
        requestId: "req_api_export_0001",
        orderText: "철도망을 확장한다",
      }),
    });
    const sourceHash = z
      .object({ stateHash: z.string() })
      .parse(await (await source.request("/api/campaign/state-hash")).json()).stateHash;

    // When
    const exported = await source.request("/api/campaign/export");
    const exportBody = await exported.json();
    const destination = createGameApp();
    const imported = await destination.request("/api/campaign/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(exportBody),
    });

    // Then
    expect(exported.status).toBe(200);
    expect(imported.status).toBe(200);
    const importedJson = await imported.json();
    const importedBody = CampaignResponseSchema.parse(importedJson);
    const importedArticle = z
      .object({
        campaign: z.object({
          resolutions: z.array(z.object({ article: ProcessedArticleSchema })).length(1),
        }),
      })
      .parse(importedJson).campaign.resolutions[0]?.article;
    expect(importedBody.stateHash).toBe(sourceHash);
    expect(importedBody.campaign.turn).toBe(1);
    expect(importedArticle?.headlineKo).toContain("철도");
    expect(importedArticle?.paragraphsKo.length).toBeGreaterThanOrEqual(2);
  });

  test("returns typed client errors for unknown scenarios and invalid turn payloads", async () => {
    // Given
    const app = createGameApp();

    // When
    const unknown = await app.request("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: "scn_unknown", playerNationId }),
    });
    const invalidTurn = await app.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "deterministic", orderText: "" }),
    });

    // Then
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({
      error: { code: "scenario_not_found", recoverable: true },
    });
    expect(invalidTurn.status).toBe(400);
    expect(await invalidTurn.json()).toMatchObject({
      error: { code: "invalid_request", recoverable: true },
    });
  });

  test("rejects scenario-mismatched and shape-changing imports without replacing state", async () => {
    // Given
    const app = createGameApp();
    const created = await createCampaign(app);
    const exported = z
      .object({
        exportVersion: z.literal(1),
        exportedStateHash: z.string(),
        scenario: z.object({ id: z.string(), revision: z.number(), canonicalHash: z.string() }),
        state: z.object({ date: z.record(z.string(), z.unknown()) }).catchall(z.unknown()),
      })
      .parse(await (await app.request("/api/campaign/export")).json());
    const scenarioMismatchState = { ...exported.state, scenarioId: "scn_unknown" };
    const nestedUnknownState = {
      ...exported.state,
      date: { ...exported.state.date, unknown: "must-not-be-stripped" },
    };

    // When
    const importState = async (state: Record<string, unknown>) =>
      app.request("/api/campaign/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...exported,
          exportedStateHash: hashCanonical(state),
          state,
        }),
      });
    const scenarioMismatch = await importState(scenarioMismatchState);
    const nestedUnknown = await importState(nestedUnknownState);
    const after = await app.request("/api/campaign/state-hash");

    // Then
    expect(scenarioMismatch.status).toBe(400);
    expect(nestedUnknown.status).toBe(400);
    expect(await scenarioMismatch.json()).toMatchObject({
      error: { code: "invalid_request", recoverable: true },
    });
    expect(await nestedUnknown.json()).toMatchObject({
      error: { code: "invalid_request", recoverable: true },
    });
    expect(await after.json()).toEqual({ stateHash: created.stateHash });
  });
});
