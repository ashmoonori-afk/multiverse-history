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
    }),
  });
  expect(response.status).toBe(201);
};

const stateHash = async (app: ReturnType<typeof createGameApp>): Promise<string> => {
  const response = await app.request("/api/campaign/state-hash");
  return z.object({ stateHash: z.string().length(64) }).parse(await response.json()).stateHash;
};

describe("multi-nation diplomacy chat", () => {
  test("persists one player message followed by ordered nation replies", async () => {
    const calls: string[] = [];
    const app = createGameApp({
      diplomacyResponders: {
        deterministic: async (input) => {
          calls.push(input.targetNationId);
          return `reply:${input.targetNationId}`;
        },
      },
    });
    await createCampaign(app);

    const response = await app.request("/api/diplomacy/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetNationIds: ["nat_jpn", "nat_qing", "nat_rus"],
        message: "조선 철도 공동투자를 논의합시다",
        provider: "deterministic",
      }),
    });

    expect(response.status).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          chatMessages: z.array(
            z.object({
              role: z.enum(["player", "counterpart"]),
              speakerNationId: z.string(),
              roomId: z.string(),
              participantNationIds: z.array(z.string()),
              sequence: z.number().int(),
              text: z.string(),
            }),
          ),
        }),
      })
      .parse(await response.json());
    expect(calls).toEqual(["nat_jpn", "nat_qing", "nat_rus"]);
    expect(body.campaign.chatMessages).toHaveLength(4);
    expect(body.campaign.chatMessages.map((message) => message.speakerNationId)).toEqual([
      "nat_kor",
      "nat_jpn",
      "nat_qing",
      "nat_rus",
    ]);
    expect(body.campaign.chatMessages.map((message) => message.sequence)).toEqual([0, 1, 2, 3]);
    expect(new Set(body.campaign.chatMessages.map((message) => message.roomId)).size).toBe(1);
    expect(body.campaign.chatMessages[0]?.participantNationIds).toEqual([
      "nat_kor",
      "nat_jpn",
      "nat_qing",
      "nat_rus",
    ]);
  });

  test("leaves state unchanged when a sequential responder fails", async () => {
    const calls: string[] = [];
    const app = createGameApp({
      diplomacyResponders: {
        deterministic: async (input) => {
          calls.push(input.targetNationId);
          if (input.targetNationId === "nat_qing") {
            throw new Error("fixture failure");
          }
          return `reply:${input.targetNationId}`;
        },
      },
    });
    await createCampaign(app);
    const beforeHash = await stateHash(app);

    const response = await app.request("/api/diplomacy/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetNationIds: ["nat_jpn", "nat_qing", "nat_rus"],
        message: "공동 성명을 논의합시다",
        provider: "deterministic",
      }),
    });

    expect(response.status).toBe(503);
    expect(calls).toEqual(["nat_jpn", "nat_qing"]);
    expect(await stateHash(app)).toBe(beforeHash);
    const campaignResponse = await app.request("/api/campaign");
    const campaign = z
      .object({
        campaign: z.object({ chatMessages: z.array(z.unknown()).length(0) }),
      })
      .parse(await campaignResponse.json());
    expect(campaign.campaign.chatMessages).toEqual([]);
  });

  test("rejects duplicate and player participants without mutation", async () => {
    const app = createGameApp();
    await createCampaign(app);
    const beforeHash = await stateHash(app);

    for (const targetNationIds of [
      ["nat_jpn", "nat_jpn"],
      ["nat_kor", "nat_jpn"],
    ]) {
      const response = await app.request("/api/diplomacy/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetNationIds,
          message: "공동 회담을 요청합니다",
          provider: "deterministic",
        }),
      });
      expect(response.status).toBe(400);
      expect(await stateHash(app)).toBe(beforeHash);
    }
  });
});
