import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";

interface TestReactionInput {
  readonly nations: readonly { readonly id: string; readonly nameKo: string }[];
  readonly eventJson: string;
  readonly contextJson: string;
}

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

const majorCrisis = {
  id: "evt_global_crisis_1",
  kind: "political",
  importance: "major",
  occurredAtElapsedDays: 30,
  turn: 1,
  date: { year: 1900, quarter: 1 },
  actorNationIds: ["nat_kor"],
  affectedNationIds: ["nat_kor", "nat_jpn", "nat_qing"],
  headlineKo: "동아시아 식량 공급 위기 확산",
  summaryKo: "대한제국·일본제국·청제국이 공동 대응에 착수했다.",
} as const;

describe("world-event feedback", () => {
  test("surfaces a world event with international feedback", async () => {
    const calls: string[] = [];
    const app = createGameApp({
      worldEventFactory: () => majorCrisis,
      reactionAuthors: {
        deterministic: async (input: TestReactionInput) =>
          input.nations.map((nation) => {
            calls.push(nation.id);
            return {
              nationId: nation.id,
              stance: nation.id === "nat_kor" ? ("supportive" as const) : ("cautious" as const),
              sentimentBps: nation.id === "nat_kor" ? 500 : 100,
              statementKo: `${nation.id} 정부는 공동 대응 방안을 검토한다.`,
            };
          }),
      },
    });
    await createCampaign(app);

    const response = await app.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deterministic",
        requestId: "req_world_event_feedback_0001",
        orderText: "철도망을 확장하고 일본에 통상 협정을 제안한다",
        cadence: "month",
      }),
    });

    expect(response.status).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          worldEvents: z.array(
            z.object({
              id: z.string(),
              importance: z.enum(["minor", "major"]),
              affectedNationIds: z.array(z.string()),
              headlineKo: z.string(),
            }),
          ),
          nationReactions: z.array(
            z.object({
              id: z.string(),
              worldEventId: z.string(),
              nationId: z.string(),
              statementKo: z.string(),
            }),
          ),
          resolutions: z.array(
            z.object({
              worldEventIds: z.array(z.string()),
              reactionIds: z.array(z.string()),
              worldImpact: z.object({ changedNationIds: z.array(z.string()) }),
            }),
          ),
        }),
      })
      .parse(await response.json());
    const resolution = body.campaign.resolutions[0];
    expect(body.campaign.worldEvents).toEqual([
      expect.objectContaining({
        id: majorCrisis.id,
        importance: "major",
        affectedNationIds: [...majorCrisis.affectedNationIds],
      }),
    ]);
    expect(calls).toEqual([...majorCrisis.affectedNationIds]);
    expect(body.campaign.nationReactions.map((reaction) => reaction.nationId)).toEqual([
      ...majorCrisis.affectedNationIds,
    ]);
    expect(new Set(body.campaign.nationReactions.map((reaction) => reaction.id)).size).toBe(3);
    expect(resolution?.worldEventIds).toEqual([majorCrisis.id]);
    expect(resolution?.reactionIds).toHaveLength(3);
    expect(resolution?.worldImpact.changedNationIds).toEqual(
      expect.arrayContaining([...majorCrisis.affectedNationIds]),
    );
  });

  test("keeps the turn atomic when one nation reaction fails", async () => {
    const calls: string[] = [];
    const app = createGameApp({
      worldEventFactory: () => majorCrisis,
      reactionAuthors: {
        deterministic: async (input: TestReactionInput) => {
          const reactions = [];
          for (const nation of input.nations) {
            calls.push(nation.id);
            if (nation.id === "nat_jpn") {
              throw new Error("fixture reaction failure");
            }
            reactions.push({
              nationId: nation.id,
              stance: "neutral" as const,
              sentimentBps: 0,
              statementKo: "상황을 주시한다.",
            });
          }
          return reactions;
        },
      },
    });
    await createCampaign(app);
    const beforeHash = await stateHash(app);

    const response = await app.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deterministic",
        requestId: "req_world_event_failure_0001",
        orderText: "철도망을 확장한다",
      }),
    });

    expect(response.status).toBe(503);
    expect(calls).toEqual(["nat_kor", "nat_jpn"]);
    expect(await stateHash(app)).toBe(beforeHash);
  });

  test("uses localized nation names in deterministic reaction copy", async () => {
    const app = createGameApp();
    await createCampaign(app);

    const response = await app.request("/api/turns/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deterministic",
        requestId: "req_localized_reactions_0001",
        orderText: "철도망을 확장하고 일본에 통상 협정을 제안한다",
      }),
    });

    expect(response.status).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          nations: z.array(z.object({ id: z.string(), nameKo: z.string() })),
          nationReactions: z.array(z.object({ nationId: z.string(), statementKo: z.string() })),
        }),
      })
      .parse(await response.json());
    const nationNameById = new Map(
      body.campaign.nations.map((nation) => [nation.id, nation.nameKo]),
    );
    for (const reaction of body.campaign.nationReactions) {
      expect(reaction.statementKo).not.toContain("nat_");
      expect(reaction.statementKo).toContain(
        nationNameById.get(reaction.nationId) ?? reaction.nationId,
      );
    }
  });
});
