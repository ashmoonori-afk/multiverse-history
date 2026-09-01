import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { createGameApp, type ProviderDiplomacyInput } from "../../src/api/app";

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

  test("acknowledges a rejection against the latest trade proposal", async () => {
    // Given
    let responderInput: ProviderDiplomacyInput | null = null;
    const app = createGameApp({
      diplomacyResponders: {
        deterministic: async (input) => {
          responderInput = input;
          return "GENERATED_REJECTION_REPLY";
        },
      },
    });
    await createCampaign(app);
    await app.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deterministic",
        requestId: "req_chat_context_0001",
        orderText: "철도망을 확장하고 일본에 통상 협정을 제안한다",
      }),
    });

    // When
    const response = await app.request("/api/diplomacy/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetNationId: "nat_jpn",
        message: "싫엉",
        provider: "deterministic",
      }),
    });

    // Then
    expect(response.status).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          chatMessages: z.array(
            z.object({
              id: z.string(),
              role: z.enum(["player", "counterpart"]),
              speakerNationId: z.string(),
              topic: z.enum(["trade", "relations", "military", "general"]),
              intent: z.enum([
                "proposal",
                "acceptance",
                "rejection",
                "question",
                "statement",
                "acknowledgement",
              ]),
              replyToMessageId: z.string().optional(),
              text: z.string(),
            }),
          ),
        }),
      })
      .parse(await response.json());
    const playerMessage = body.campaign.chatMessages.at(-2);
    const counterpartMessage = body.campaign.chatMessages.at(-1);
    expect(playerMessage).toMatchObject({
      role: "player",
      intent: "rejection",
    });
    expect(counterpartMessage).toMatchObject({
      role: "counterpart",
      speakerNationId: "nat_jpn",
      intent: "acknowledgement",
      replyToMessageId: playerMessage?.id,
      text: "GENERATED_REJECTION_REPLY",
    });
    expect(responderInput).toMatchObject({
      targetNationId: "nat_jpn",
      message: "싫엉",
      decision: {
        topic: "trade",
        intent: "rejection",
      },
    });
  });

  test("does not repeat an unresolved inbound trade proposal on the next turn", async () => {
    // Given
    const app = createGameApp();
    await createCampaign(app);
    await app.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deterministic",
        requestId: "req_chat_dedupe_0001",
        orderText: "철도망을 확장하고 일본에 통상 협정을 제안한다",
      }),
    });

    // When
    const response = await app.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deterministic",
        requestId: "req_chat_dedupe_0002",
        orderText: "철도망을 확장하고 일본에 통상 협정을 제안한다",
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
                topic: z.enum(["trade", "relations", "military", "general"]),
                intent: z.enum([
                  "proposal",
                  "acceptance",
                  "rejection",
                  "question",
                  "statement",
                  "acknowledgement",
                ]),
                sourceKey: z.string().optional(),
              }),
            )
            .length(1),
        }),
      })
      .parse(await response.json());
    expect(body.campaign.chatMessages[0]).toMatchObject({
      role: "counterpart",
      topic: "trade",
      intent: "proposal",
    });
  });
});
