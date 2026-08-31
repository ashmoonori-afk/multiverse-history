import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";

const createCampaign = async (app: ReturnType<typeof createGameApp>): Promise<void> => {
  const response = await app.request("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenarioId: "scn_ea1900",
      playerNationId: "nat_kor",
      provider: "deterministic",
    }),
  });
  expect(response.status).toBe(201);
};

const stateHash = async (app: ReturnType<typeof createGameApp>): Promise<string> => {
  const response = await app.request("/api/campaign/state-hash");
  return z.object({ stateHash: z.string().length(64) }).parse(await response.json()).stateHash;
};

describe("long-horizon timeline progression", () => {
  test("advances exactly 18 monthly steps and persists the result", async () => {
    const app = createGameApp();
    await createCampaign(app);

    const response = await app.request("/api/timeline/jump", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        progression: { mode: "months", months: 18 },
      }),
    });

    expect(response.status).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          elapsedDays: z.literal(540),
          date: z.object({ year: z.literal(1901), quarter: z.literal(3) }),
          turn: z.literal(0),
          lastProgression: z.object({
            mode: z.literal("months"),
            advanceDays: z.literal(540),
            steps: z.literal(18),
            stopReason: z.literal("requested_duration"),
          }),
        }),
        stateHash: z.string().length(64),
      })
      .parse(await response.json());
    expect(body.campaign.lastProgression.steps).toBe(18);

    const exported = await app.request("/api/campaign/export");
    const imported = await app.request("/api/campaign/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(await exported.json()),
    });
    const importedBody = z
      .object({
        campaign: z.object({
          elapsedDays: z.literal(540),
          lastProgression: z.object({
            mode: z.literal("months"),
            steps: z.literal(18),
          }),
        }),
        stateHash: z.string().length(64),
      })
      .parse(await imported.json());
    expect(importedBody.stateHash).toBe(body.stateHash);
  });

  test("stops on the first typed major event within hard bounds", async () => {
    const app = createGameApp();
    await createCampaign(app);

    const response = await app.request("/api/timeline/jump", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        progression: { mode: "until_major_event" },
      }),
    });

    expect(response.status).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          elapsedDays: z.number().int().positive().max(548),
          lastProgression: z.object({
            mode: z.literal("until_major_event"),
            advanceDays: z.number().int().positive().max(548),
            steps: z.number().int().positive().max(24),
            stopReason: z.literal("major_event"),
            majorEventId: z.string(),
          }),
          worldEvents: z.array(
            z.object({
              id: z.string(),
              importance: z.enum(["minor", "major"]),
              affectedNationIds: z.array(z.string()).min(3),
            }),
          ),
          nationReactions: z.array(z.object({ worldEventId: z.string(), nationId: z.string() })),
        }),
      })
      .parse(await response.json());
    const majorEvent = body.campaign.worldEvents.find(
      (event) => event.id === body.campaign.lastProgression.majorEventId,
    );
    expect(majorEvent?.importance).toBe("major");
    expect(body.campaign.nationReactions).toHaveLength(majorEvent?.affectedNationIds.length ?? 0);
  });

  test("rejects out-of-range months without mutating campaign state", async () => {
    const app = createGameApp();
    await createCampaign(app);
    const beforeHash = await stateHash(app);

    for (const months of [0, 19]) {
      const response = await app.request("/api/timeline/jump", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          progression: { mode: "months", months },
        }),
      });
      expect(response.status).toBe(400);
      expect(await stateHash(app)).toBe(beforeHash);
    }
  });

  test("preserves the existing single-month cadence request", async () => {
    const app = createGameApp();
    await createCampaign(app);

    const response = await app.request("/api/timeline/jump", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cadence: "month" }),
    });

    expect(response.status).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          elapsedDays: z.literal(30),
          turn: z.literal(0),
        }),
      })
      .parse(await response.json());
    expect(body.campaign.elapsedDays).toBe(30);
  });
});
