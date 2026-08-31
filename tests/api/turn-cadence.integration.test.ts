import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";

describe("turn cadence API", () => {
  test("advances the selected month and records it on the resolution", async () => {
    // Given
    const app = createGameApp();
    await app.request("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: "scn_ea1900", playerNationId: "nat_kor" }),
    });

    // When
    const response = await app.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deterministic",
        requestId: "req_cadence_month_0001",
        orderText: "철도망을 확장하고 일본에 통상 협정을 제안한다",
        cadence: "month",
      }),
    });

    // Then
    expect(response.status).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          elapsedDays: z.literal(30),
          date: z.object({ year: z.literal(1900), quarter: z.literal(1) }),
          resolutions: z
            .array(
              z.object({
                cadence: z.literal("month"),
                advanceDays: z.literal(30),
              }),
            )
            .length(1),
        }),
      })
      .parse(await response.json());
    expect(body.campaign.resolutions[0]).toEqual({
      cadence: "month",
      advanceDays: 30,
    });
  });
});
