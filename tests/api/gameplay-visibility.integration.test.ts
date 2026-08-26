import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";

const campaignInput = {
  scenarioId: "scn_ea1900",
  playerNationId: "nat_kor",
} as const;

const createCampaign = async (app: ReturnType<typeof createGameApp>): Promise<void> => {
  const response = await app.request("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(campaignInput),
  });
  expect(response.status).toBe(201);
};

describe("visible gameplay resolution and chat", () => {
  test("records concrete deltas and changed-world entities for the exact order", async () => {
    // Given
    const app = createGameApp();
    await createCampaign(app);

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
  });

  test("persists a deterministic counterpart reply in campaign chat history", async () => {
    // Given
    const app = createGameApp();
    await createCampaign(app);

    // When
    const response = await app.request("/api/diplomacy/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetNationId: "nat_jpn",
        message: "일본과 지금 협상할 수 있는 선택지를 요약해줘",
      }),
    });

    // Then
    expect(response.status).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          chatMessages: z
            .array(
              z.object({
                role: z.enum(["player", "counterpart"]),
                speakerNationId: z.string(),
                text: z.string(),
              }),
            )
            .length(2),
        }),
      })
      .parse(await response.json());
    expect(body.campaign.chatMessages[0]?.text).toBe(
      "일본과 지금 협상할 수 있는 선택지를 요약해줘",
    );
    expect(body.campaign.chatMessages[0]?.speakerNationId).toBe("nat_kor");
    expect(body.campaign.chatMessages[1]?.role).toBe("counterpart");
    expect(body.campaign.chatMessages[1]?.text).toContain("통상");
  });
});
