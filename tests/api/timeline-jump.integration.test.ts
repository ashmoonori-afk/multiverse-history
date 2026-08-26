import { describe, expect, test } from "bun:test";

import { createGameApp } from "../../src/api/app";

describe("timeline jump API", () => {
  test("persists week and year cadence jumps in canonical campaign state", async () => {
    const app = createGameApp();
    await app.request("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: "scn_ea1900", playerNationId: "nat_kor" }),
    });

    const weekResponse = await app.request("/api/timeline/jump", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cadence: "week" }),
    });
    expect(weekResponse.status).toBe(200);
    const weekBody = (await weekResponse.json()) as {
      campaign: { elapsedDays: number; date: { year: number; quarter: number } };
    };
    expect(weekBody.campaign).toMatchObject({
      elapsedDays: 7,
      date: { year: 1900, quarter: 1 },
    });

    const yearResponse = await app.request("/api/timeline/jump", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cadence: "year" }),
    });
    expect(yearResponse.status).toBe(200);
    const yearBody = (await yearResponse.json()) as {
      campaign: { elapsedDays: number; date: { year: number; quarter: number } };
    };
    expect(yearBody.campaign).toMatchObject({
      elapsedDays: 372,
      date: { year: 1901, quarter: 1 },
    });

    for (const cadence of ["month", "quarter", "major"] as const) {
      const response = await app.request("/api/timeline/jump", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cadence }),
      });
      expect(response.status).toBe(200);
    }
  });
});
