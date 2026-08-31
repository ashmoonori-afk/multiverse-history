import { expect, test } from "bun:test";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";

test("records processed news and concrete world deltas for the exact order", async () => {
  // Given
  const app = createGameApp();
  const created = await app.request("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenarioId: "scn_ea1900",
      playerNationId: "nat_kor",
    }),
  });
  expect(created.status).toBe(201);

  // When
  const response = await app.request("/api/turns/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "deterministic",
      requestId: "req_visibility_resolution_0001",
      orderText: "철도망을 확장하고 일본에 통상 협정을 제안한다",
    }),
  });

  // Then
  expect(response.status).toBe(200);
  const body = z
    .object({
      campaign: z.object({
        resolutions: z
          .array(
            z.object({
              turn: z.literal(1),
              timestampKo: z.string().includes("1900"),
              narrativeKo: z.string().min(1),
              articleKo: z.string().min(1),
              article: z
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
                .strict(),
              nationDeltas: z.array(
                z.object({
                  nationId: z.string(),
                  treasuryCredits: z.object({ before: z.number(), after: z.number() }),
                  infrastructureBps: z.object({ before: z.number(), after: z.number() }),
                }),
              ),
              relationDeltas: z.array(
                z.object({
                  fromNationId: z.literal("nat_kor"),
                  toNationId: z.literal("nat_jpn"),
                  before: z.number(),
                  after: z.number(),
                }),
              ),
              treatyDeltas: z.array(
                z.object({
                  recipientNationId: z.literal("nat_jpn"),
                  clauses: z.array(z.literal("trade")),
                }),
              ),
              worldImpact: z.object({
                changedNationIds: z.array(z.string()),
                changedProvinceIds: z.array(z.string()),
                summaryKo: z.string().includes("일본제국"),
              }),
            }),
          )
          .length(1),
        chatMessages: z.array(
          z.object({
            role: z.enum(["player", "counterpart"]),
            speakerNationId: z.string(),
            targetNationId: z.string(),
            turn: z.number().int(),
          }),
        ),
      }),
    })
    .parse(await response.json());
  const resolution = body.campaign.resolutions[0];
  expect(resolution?.worldImpact.changedNationIds).toContain("nat_jpn");
  expect(resolution?.worldImpact.changedProvinceIds).toContain("prv_kor_hanseong");
  expect(resolution?.nationDeltas).toContainEqual({
    nationId: "nat_kor",
    treasuryCredits: { before: 240, after: 215 },
    infrastructureBps: { before: 2_400, after: 2_650 },
  });
  expect(resolution?.relationDeltas[0]?.after).toBe(-450);
  const articleSentenceCount = resolution?.articleKo.match(/[.!?](?:\s|$)/gu)?.length ?? 0;
  expect(articleSentenceCount).toBeGreaterThanOrEqual(5);
  expect(articleSentenceCount).toBeLessThanOrEqual(7);
  expect(resolution?.articleKo).not.toContain("prv_");
  expect(resolution?.article.headlineKo).not.toBe("철도망을 확장하고 일본에 통상 협정을 제안한다");
  expect(resolution?.article.ledeKo).not.toBe(resolution?.articleKo);
  expect(resolution?.article.paragraphsKo.join(" ")).toContain("국고");
  expect(resolution?.article.paragraphsKo.join(" ")).toContain("관계");
  expect(resolution?.article.quote?.attributionKo).toContain("대한제국");
  expect(resolution?.article.quote?.textKo).not.toBe(
    "철도망을 확장하고 일본에 통상 협정을 제안한다",
  );
  expect(resolution?.article.paragraphsKo).not.toContain(resolution?.worldImpact.summaryKo);
  const rawNarrativeLead = resolution?.narrativeKo.split(/[.!?](?:\s|$)/u)[0]?.trim();
  expect(resolution?.article.paragraphsKo).not.toContain(rawNarrativeLead);
  expect(body.campaign.chatMessages).toEqual([
    expect.objectContaining({
      role: "counterpart",
      speakerNationId: "nat_jpn",
      targetNationId: "nat_kor",
      turn: 1,
    }),
  ]);
});
