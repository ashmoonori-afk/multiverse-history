import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";

const orderText =
  "제주부에 무역특구 지정 입항을 원하는 서구열강을 모집. 필수조항은 무기지원 및 교육장교파견";

describe("planner intent grounding", () => {
  test("removes invented rail spending and preserves diplomatic conditions", async () => {
    // Given
    const app = createGameApp({
      planners: {
        deterministic: async (input) => ({
          schemaVersion: 2,
          requestId: input.requestId,
          playerIntents: [
            {
              type: "economy.invest",
              actorNationId: "nat_kor",
              provinceId: "prv_kor_jeolla",
              sector: "rail",
              budgetCredits: 80,
            },
            {
              type: "diplomacy.propose_treaty",
              actorNationId: "nat_kor",
              recipientNationId: "nat_gbr",
              clauses: ["trade"],
            },
          ],
          npcIntents: [
            {
              type: "military.recruit",
              actorNationId: "nat_jpn",
              provinceId: "prv_jpn_kanto",
              manpower: 2_000,
            },
          ],
          narrative: { ko: "대한제국은 서구 열강에 제주 입항 조건을 제안했다." },
          warnings: [],
        }),
      },
    });
    const creation = await app.request("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenarioId: "scn_ea1900",
        playerNationId: "nat_kor",
        provider: "deterministic",
      }),
    });
    expect(creation.status).toBe(201);

    // When
    const response = await app.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deterministic",
        requestId: "req_grounding_trade_zone",
        orderText,
        cadence: "quarter",
      }),
    });
    const responseBody: unknown = await response.json();
    expect(response.status, JSON.stringify(responseBody)).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          constructionProjects: z.array(z.unknown()),
          treaties: z.array(
            z.object({
              clauses: z.array(z.string()),
            }),
          ),
          resolutions: z.array(
            z.object({
              article: z.object({ headlineKo: z.string() }),
            }),
          ),
        }),
        plan: z.object({
          playerIntents: z.array(
            z
              .object({
                type: z.string(),
                provinceId: z.string().optional(),
                termsKo: z.string().optional(),
              })
              .passthrough(),
          ),
        }),
      })
      .parse(responseBody);

    // Then
    expect(body.campaign.constructionProjects).toEqual([]);
    expect(body.plan.playerIntents.some((intent) => intent.type === "economy.invest")).toBe(false);
    expect(body.campaign.treaties[0]?.clauses).toEqual([
      "trade",
      "port_access",
      "weapons_support",
      "officer_training",
    ]);
    expect(body.plan.playerIntents[0]?.provinceId).toBe("prv_kor_jeolla");
    expect(body.plan.playerIntents[0]?.termsKo).toBe(orderText);
    expect(body.campaign.resolutions[0]?.article.headlineKo).not.toContain("철도");
  });
});
