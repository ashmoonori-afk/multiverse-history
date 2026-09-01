import { describe, expect, test } from "bun:test";

import type { CampaignChatDecision } from "../../src/application/campaign-chat";
import { respondWithLiveDiplomacy } from "../../src/providers/live-diplomacy";
import { authorLiveNews } from "../../src/providers/live-news";
import { authorLiveReactions } from "../../src/providers/live-reaction";
import type { ProviderProcessInput } from "../../src/providers/process-runner";
import type { StructuredInvocationRunner } from "../../src/providers/structured-invocation";

const claudeRunner =
  (structuredOutput: object): StructuredInvocationRunner =>
  async () => ({
    exitCode: 0,
    stdout: JSON.stringify({
      type: "result",
      subtype: "success",
      structured_output: structuredOutput,
    }),
    stderr: "",
  });

describe("live structured authors", () => {
  test("authors a bounded news article from trusted state context", async () => {
    // Given
    const orderText = "철도에 투자한다";
    const runner = claudeRunner({
      headlineKo: "대한제국, 간선 철도 정비 착수",
      ledeKo: "정부가 물류 기반 확충을 위한 장기 사업을 발표했다.",
      paragraphsKo: [
        "첫 사업은 한성과 주요 항구를 연결하는 구간에 집중된다.",
        "재정 당국은 단계별 집행으로 국고 부담을 관리할 방침이다.",
      ],
    });

    // When
    const article = await authorLiveNews({
      provider: "claude",
      orderText,
      contextJson: '{"turn":1}',
      runner,
    });

    // Then
    expect(article.headlineKo).toBe("대한제국, 간선 철도 정비 착수");
  });

  test("keeps the raw player order out of the news author prompt", async () => {
    const orderText = "RAW_ORDER_SHOULD_STAY_AUDIT_ONLY";
    let processInput: ProviderProcessInput | undefined;
    const runner: StructuredInvocationRunner = async (input) => {
      processInput = input;
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          type: "result",
          subtype: "success",
          structured_output: {
            headlineKo: "철도 투자 결과 발표",
            ledeKo: "정부가 확정된 기반시설 사업의 성과를 공개했다.",
            paragraphsKo: [
              "한성 권역의 물류 기반이 계획에 따라 확충됐다.",
              "재정 집행 결과와 역내 영향은 후속 통계로 공개될 예정이다.",
            ],
          },
        }),
        stderr: "",
      };
    };

    await authorLiveNews({
      provider: "claude",
      orderText,
      contextJson: '{"actionKind":"rail_investment","result":"confirmed"}',
      runner,
    });

    expect(processInput?.stdin).toContain('"actionKind":"rail_investment"');
    expect(processInput?.stdin).not.toContain(orderText);
  });

  test("authors reactions through one serial structured invocation", async () => {
    // Given
    let calls = 0;
    let processInput: ProviderProcessInput | undefined;
    const runner: StructuredInvocationRunner = async (input) => {
      calls += 1;
      processInput = input;
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          type: "result",
          subtype: "success",
          structured_output: {
            reactions: [
              {
                nationId: "nat_jpn",
                stance: "cautious",
                sentimentBps: -100,
                statementKo: "새 철도망의 역내 교역 효과를 검토하겠습니다.",
              },
            ],
          },
        }),
        stderr: "",
      };
    };

    // When
    const output = await authorLiveReactions({
      provider: "claude",
      eventJson: '{"id":"evt_1_1"}',
      contextJson:
        '{"reactingNation":{"id":"nat_jpn","nameKo":"일본제국","capitalLabelKo":"도쿄"}}',
      runner,
    });

    // Then
    expect(output.reactions).toHaveLength(1);
    expect(calls).toBe(1);
    const schemaFlagIndex = processInput?.args.indexOf("--json-schema") ?? -1;
    const schemaValue = processInput?.args.at(schemaFlagIndex + 1);
    expect(schemaFlagIndex).toBeGreaterThanOrEqual(0);
    expect(schemaValue).toBeDefined();
    const schema = JSON.parse(schemaValue ?? "{}");
    expect(schema.properties.reactions.maxItems).toBe(1);
    expect(schema.properties.reactions.items.properties.nationId.enum).toEqual(["nat_jpn"]);
  });

  test("rejects a reaction authored for a different requested nation", async () => {
    // Given
    const runner = claudeRunner({
      reactions: [
        {
          nationId: "nat_rus",
          stance: "cautious",
          sentimentBps: -100,
          statementKo: "상황을 검토하겠습니다.",
        },
      ],
    });

    // When
    const invocation = authorLiveReactions({
      provider: "claude",
      eventJson: '{"id":"evt_1_1"}',
      contextJson:
        '{"reactingNation":{"id":"nat_kor","nameKo":"대한제국","capitalLabelKo":"한성"}}',
      runner,
    });

    // Then
    await expect(invocation).rejects.toThrow("PROVIDER_REACTION_NATION_MISMATCH");
  });

  test("authors diplomacy with the shared structured invocation", async () => {
    // Given
    const decision: CampaignChatDecision = { topic: "trade", intent: "question" };
    let processInput: ProviderProcessInput | undefined;
    const runner: StructuredInvocationRunner = async (input) => {
      processInput = input;
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          type: "result",
          subtype: "success",
          structured_output: {
            replies: [
              {
                speakerNationId: "nat_jpn",
                textKo: "상호 관세 인하와 철도 화물 연결을 제안합니다.",
              },
            ],
          },
        }),
        stderr: "",
      };
    };

    // When
    const reply = await respondWithLiveDiplomacy({
      provider: "claude",
      playerNationName: "대한제국",
      targetNationName: "일본제국",
      playerMessage: "조건이 무엇입니까?",
      decision,
      stateJson: '{"turn":1}',
      runner,
    });

    // Then
    expect(reply).toBe("상호 관세 인하와 철도 화물 연결을 제안합니다.");
    expect(processInput?.stdin).toContain("BEGIN_UNTRUSTED_PLAYER_MESSAGE");
  });
});
