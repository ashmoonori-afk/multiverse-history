import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";

interface TestNewsAuthorInput {
  readonly orderText: string;
  readonly contextJson: string;
  readonly deterministicArticle: unknown;
}

const campaignInput = {
  scenarioId: "scn_ea1900",
  playerNationId: "nat_kor",
  provider: "deterministic",
} as const;

const createCampaign = async (app: ReturnType<typeof createGameApp>): Promise<void> => {
  const response = await app.request("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(campaignInput),
  });
  expect(response.status).toBe(201);
};

const stateHash = async (app: ReturnType<typeof createGameApp>): Promise<string> => {
  const response = await app.request("/api/campaign/state-hash");
  return z.object({ stateHash: z.string().length(64) }).parse(await response.json()).stateHash;
};

const turnRequest = (orderText: string): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    provider: "deterministic",
    requestId: "req_generative_news_0001",
    orderText,
    cadence: "month",
  }),
});

describe("provider-authored campaign news", () => {
  test("turns player action into provider-authored editorial news", async () => {
    const orderText = "평양에 제철소를 건설하고 러시아와 기술협정을 체결한다";
    let authorInput: TestNewsAuthorInput | undefined;
    const article = {
      headlineKo: "평양 중공업 계획, 북방 기술 외교와 맞물리다",
      ledeKo: "대한제국 정부가 산업 기반 확장과 기술 교류를 함께 추진한다.",
      paragraphsKo: [
        "평양 권역의 생산 기반은 장기 투자 계획에 따라 단계적으로 확충된다.",
        "북방 국가와의 협의는 설비 표준과 기술 인력 교류에 초점을 맞춘다.",
      ],
      quote: {
        textKo: "산업과 외교를 하나의 장기 전략으로 연결하겠다",
        attributionKo: "대한제국 정부 관계자",
      },
    };
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
              recipientNationId: "nat_rus",
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
          narrative: {
            ko: "대한제국은 평양 중공업 계획과 북방 기술 협의를 함께 추진했다.",
          },
          warnings: [],
        }),
      },
      newsAuthors: {
        deterministic: async (input: TestNewsAuthorInput) => {
          authorInput = input;
          return article;
        },
      },
    });
    await createCampaign(app);

    const response = await app.request("/api/turns/preview", turnRequest(orderText));
    const responseBody: unknown = await response.json();

    expect(response.status, JSON.stringify(responseBody)).toBe(200);
    const body = z
      .object({
        campaign: z.object({
          resolutions: z
            .array(
              z.object({
                orderText: z.string(),
                article: z.object({
                  headlineKo: z.string(),
                  ledeKo: z.string(),
                  paragraphsKo: z.array(z.string()),
                  quote: z
                    .object({
                      textKo: z.string(),
                      attributionKo: z.string(),
                    })
                    .optional(),
                }),
                articleKo: z.string(),
              }),
            )
            .length(1),
        }),
      })
      .parse(responseBody);
    const resolution = body.campaign.resolutions[0];
    expect(resolution?.article).toEqual(article);
    expect(resolution?.articleKo).toBe([article.ledeKo, ...article.paragraphsKo].join(" "));
    expect(resolution?.article.paragraphsKo).not.toContain(orderText);
    expect(authorInput?.orderText).toBe(orderText);
    expect(authorInput?.contextJson).not.toContain(orderText);
    const context = z
      .object({
        campaign: z.object({
          turn: z.number().int(),
          date: z.object({ year: z.number().int(), quarter: z.number().int() }),
        }),
        resolution: z.object({
          nationDeltas: z.array(z.unknown()),
          relationDeltas: z.array(z.unknown()),
          treatyDeltas: z.array(z.unknown()),
          worldImpact: z.object({
            changedNationIds: z.array(z.string()),
            changedProvinceIds: z.array(z.string()),
          }),
        }),
      })
      .parse(JSON.parse(authorInput?.contextJson ?? "{}"));
    expect(context.campaign.turn).toBe(1);
    expect(context.resolution.worldImpact.changedProvinceIds).toContain("prv_kor_hanseong");
  });

  test("keeps the full turn atomic when news authoring fails", async () => {
    const app = createGameApp({
      newsAuthors: {
        deterministic: async () => {
          throw new Error("fixture news failure");
        },
      },
    });
    await createCampaign(app);
    const beforeHash = await stateHash(app);

    const response = await app.request(
      "/api/turns/preview",
      turnRequest("한성의 철도망을 확장한다"),
    );

    expect(response.status).toBe(503);
    expect(await stateHash(app)).toBe(beforeHash);
  });

  test("rejects a provider article that parrots the raw action", async () => {
    const orderText = "한성의 철도망을 확장한다";
    const app = createGameApp({
      newsAuthors: {
        deterministic: async () => ({
          headlineKo: orderText,
          ledeKo: "정부가 기반시설 계획의 집행 결과를 발표했다.",
          paragraphsKo: [
            "철도 사업은 재정 심사를 거쳐 착수 단계에 들어갔다.",
            "정부는 물류 효율과 지역 경제 지표를 함께 추적할 계획이다.",
          ],
        }),
      },
    });
    await createCampaign(app);
    const beforeHash = await stateHash(app);

    const response = await app.request("/api/turns/preview", turnRequest(orderText));

    expect(response.status).toBe(422);
    expect(await stateHash(app)).toBe(beforeHash);
  });
});
