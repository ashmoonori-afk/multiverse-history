import { expect, test } from "bun:test";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";

interface TestReactionInput {
  readonly nationId: string;
}

test("generates one distinct reaction per affected nation", async () => {
  const calls: string[] = [];
  const app = createGameApp({
    planners: {
      deterministic: async (input) => ({
        schemaVersion: 1,
        requestId: input.requestId,
        playerIntents: [
          {
            type: "economy.invest",
            actorNationId: "nat_kor",
            provinceId: "prv_kor_hanseong",
            sector: "rail",
            budgetCredits: 25,
          },
          {
            type: "diplomacy.propose_treaty",
            actorNationId: "nat_kor",
            recipientNationId: "nat_jpn",
            clauses: ["trade"],
          },
        ],
        npcIntents: [
          {
            type: "military.recruit",
            actorNationId: "nat_qing",
            provinceId: "prv_qing_zhili",
            manpower: 5_000,
          },
        ],
        narrative: { ko: "대한제국의 철도·통상 계획에 청제국의 군사 조치가 이어졌다." },
        warnings: [],
      }),
    },
    reactionAuthors: {
      deterministic: async (input: TestReactionInput) => {
        calls.push(input.nationId);
        return {
          nationId: input.nationId,
          stance: input.nationId === "nat_kor" ? "supportive" : "cautious",
          sentimentBps: calls.length * 100,
          statementKo: `${input.nationId}의 ${calls.length}번째 독립 반응`,
        };
      },
    },
  });
  const created = await app.request("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenarioId: "scn_ea1900",
      playerNationId: "nat_kor",
    }),
  });
  expect(created.status).toBe(201);

  const response = await app.request("/api/turns/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "deterministic",
      requestId: "req_multi_nation_reactions_0001",
      orderText: "철도망을 확장하고 일본과 통상 협정을 추진한다",
      cadence: "month",
    }),
  });

  expect(response.status).toBe(200);
  const body = z
    .object({
      campaign: z.object({
        nationReactions: z.array(
          z.object({
            id: z.string(),
            nationId: z.string(),
            statementKo: z.string(),
          }),
        ),
        resolutions: z.array(
          z.object({
            reactionIds: z.array(z.string()),
            worldImpact: z.object({ changedNationIds: z.array(z.string()) }),
          }),
        ),
      }),
      stateHash: z.string().length(64),
    })
    .parse(await response.json());
  const expectedNationIds = ["nat_kor", "nat_jpn", "nat_qing"];
  const resolution = body.campaign.resolutions[0];
  expect(calls).toEqual(expectedNationIds);
  expect(resolution?.worldImpact.changedNationIds).toEqual(expectedNationIds);
  expect(body.campaign.nationReactions.map((reaction) => reaction.nationId)).toEqual(
    expectedNationIds,
  );
  expect(resolution?.reactionIds).toEqual(
    body.campaign.nationReactions.map((reaction) => reaction.id),
  );
  expect(new Set(body.campaign.nationReactions.map((reaction) => reaction.statementKo)).size).toBe(
    3,
  );

  const exported = await app.request("/api/campaign/export");
  const imported = await app.request("/api/campaign/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(await exported.json()),
  });
  expect(imported.status).toBe(200);
  const importedBody = z
    .object({
      campaign: z.object({
        nationReactions: z.array(z.object({ id: z.string(), nationId: z.string() })),
      }),
      stateHash: z.string().length(64),
    })
    .parse(await imported.json());
  expect(importedBody.campaign.nationReactions).toEqual(
    body.campaign.nationReactions.map(({ id, nationId }) => ({ id, nationId })),
  );
  expect(importedBody.stateHash).toBe(body.stateHash);
});
