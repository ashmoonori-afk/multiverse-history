import { describe, expect, test } from "bun:test";

import { groupChatJsonSchema, parseGroupChatOutput } from "../../src/providers/group-chat-schema";
import { newsJsonSchema, parseNewsOutput } from "../../src/providers/news-schema";
import { parseReactionOutput, reactionJsonSchema } from "../../src/providers/reaction-schema";

const groupChat = {
  replies: [{ speakerNationId: "nat_jpn", textKo: "상호 관세 인하를 제안합니다." }],
};
const news = {
  headlineKo: "한성 철도망 확장 착수",
  ledeKo: "대한제국 정부가 국가 기반시설 투자 계획을 발표했다.",
  paragraphsKo: [
    "정부는 주요 도시를 잇는 철도 구간을 우선 정비한다고 밝혔다.",
    "시장에서는 물류 비용 감소와 장기 성장 효과를 기대하고 있다.",
  ],
};
const reactions = {
  reactions: [
    {
      nationId: "nat_jpn",
      stance: "cautious" as const,
      sentimentBps: -250,
      statementKo: "역내 교역에 미칠 영향을 검토하겠습니다.",
    },
  ],
};

const invalidShapes = (valid: object): readonly object[] => [{}, { ...valid, unexpected: true }];

describe("disjoint structured provider schemas", () => {
  test("parses one valid output for each schema", () => {
    // Given
    const rawOrder = "전국 철도에 투자한다";

    // When
    const parsedChat = parseGroupChatOutput(groupChat);
    const parsedNews = parseNewsOutput(news, rawOrder);
    const parsedReactions = parseReactionOutput(reactions);

    // Then
    expect(parsedChat).toEqual(groupChat);
    expect(parsedNews).toEqual(news);
    expect(parsedReactions).toEqual(reactions);
  });

  test("normalizes the required nullable provider quote into an omitted domain quote", () => {
    // Given
    const providerNews = { ...news, quote: null };

    // When
    const parsed = parseNewsOutput(providerNews, "철도 투자");

    // Then
    expect(parsed).toEqual(news);
  });

  test("rejects empty, malformed, extra-field, and oversized outputs", () => {
    // Given
    const invalidChat = [
      ...invalidShapes(groupChat),
      { replies: [{ speakerNationId: "Japan", textKo: "응답" }] },
      { replies: [{ speakerNationId: "nat_jpn", textKo: "가".repeat(1_201) }] },
    ];
    const invalidNews = [
      ...invalidShapes(news),
      { ...news, paragraphsKo: ["한 문단뿐이다."] },
      { ...news, headlineKo: "가".repeat(161) },
    ];
    const invalidReactions = [
      ...invalidShapes(reactions),
      { reactions: [{ ...reactions.reactions[0], sentimentBps: 10_001 }] },
      { reactions: Array.from({ length: 17 }, () => reactions.reactions[0]) },
    ];

    // When
    const parseInvalidChat = () => invalidChat.map(parseGroupChatOutput);
    const parseInvalidNews = () => invalidNews.map((value) => parseNewsOutput(value, "철도 투자"));
    const parseInvalidReactions = () => invalidReactions.map(parseReactionOutput);

    // Then
    expect(parseInvalidChat).toThrow();
    expect(parseInvalidNews).toThrow();
    expect(parseInvalidReactions).toThrow();
  });

  test("rejects outputs belonging to another provider lane", () => {
    // Given
    const crossSchemaOutputs = [groupChat, news, reactions];

    // When
    const parseCrossSchema = () => {
      parseGroupChatOutput(crossSchemaOutputs[1]);
      parseNewsOutput(crossSchemaOutputs[2], "철도 투자");
      parseReactionOutput(crossSchemaOutputs[0]);
    };

    // Then
    expect(parseCrossSchema).toThrow();
  });

  test("rejects normalized exact and substring parroting of the raw order", () => {
    // Given
    const rawOrder = "  전국 철도망을, 확장한다! ";
    const exact = { ...news, headlineKo: "전국 철도망을 확장한다" };
    const substring = {
      ...news,
      ledeKo: "정부는 전국 철도망을 확장한다는 명령을 그대로 발표했다.",
    };

    // When
    const parseExact = () => parseNewsOutput(exact, rawOrder);
    const parseSubstring = () => parseNewsOutput(substring, rawOrder);

    // Then
    expect(parseExact).toThrow("PROVIDER_NEWS_PARROTS_ORDER");
    expect(parseSubstring).toThrow("PROVIDER_NEWS_PARROTS_ORDER");
  });

  test("emits strict draft-07 schemas for all three CLIs", () => {
    // Given
    const schemas = [groupChatJsonSchema(), newsJsonSchema(), reactionJsonSchema()];

    // When
    const serialized = schemas.map((schema) => JSON.stringify(schema));

    // Then
    for (const schema of serialized) {
      expect(schema).toContain("http://json-schema.org/draft-07/schema#");
      expect(schema).toContain('"additionalProperties":false');
    }
  });
});
