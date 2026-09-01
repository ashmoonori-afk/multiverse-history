import { describe, expect, test } from "bun:test";

import { createCampaignState } from "../../src/application/campaign-state";
import {
  authorCampaignEventReactions,
  type CampaignReactionAuthorInput,
} from "../../src/application/campaign-world-feedback";

const event = {
  id: "evt_batch_1",
  kind: "political",
  importance: "major",
  occurredAtElapsedDays: 0,
  turn: 1,
  date: { year: 1900, quarter: 1 },
  actorNationIds: ["nat_kor"],
  affectedNationIds: ["nat_kor", "nat_jpn", "nat_qing"],
  headlineKo: "배치 반응 검증 사건",
  summaryKo: "세 나라가 동시에 반응해야 하는 사건이다.",
} as const;

describe("batched nation reactions", () => {
  test("authors every affected nation's reaction in ONE provider call", async () => {
    // Given
    const state = createCampaignState("scn_ea1900", "nat_kor");
    const calls: CampaignReactionAuthorInput[] = [];
    const reactionAuthor = async (input: CampaignReactionAuthorInput) => {
      calls.push(input);
      return input.nations.map((nation) => ({
        nationId: nation.id,
        stance: "neutral" as const,
        sentimentBps: 0,
        statementKo: `${nation.nameKo} 정부가 입장을 밝혔다.`,
      }));
    };

    // When
    const reactions = await authorCampaignEventReactions({
      state,
      event: event as never,
      reactionAuthor,
    });

    // Then: exactly one provider invocation covering all affected nations, and
    // the persisted reactions follow the event's affected-nation order.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.nations.map((nation) => nation.id)).toEqual([
      "nat_kor",
      "nat_jpn",
      "nat_qing",
    ]);
    expect(reactions.map((reaction) => reaction.nationId)).toEqual([
      "nat_kor",
      "nat_jpn",
      "nat_qing",
    ]);
    expect(reactions.map((reaction) => reaction.id)).toEqual([
      "rct_evt_batch_1_nat_kor",
      "rct_evt_batch_1_nat_jpn",
      "rct_evt_batch_1_nat_qing",
    ]);
  });

  test("fails the whole batch when a requested nation's reaction is missing", async () => {
    const state = createCampaignState("scn_ea1900", "nat_kor");
    const reactionAuthor = async (input: CampaignReactionAuthorInput) =>
      input.nations.slice(0, 1).map((nation) => ({
        nationId: nation.id,
        stance: "neutral" as const,
        sentimentBps: 0,
        statementKo: `${nation.nameKo} 정부가 입장을 밝혔다.`,
      }));

    await expect(
      authorCampaignEventReactions({ state, event: event as never, reactionAuthor }),
    ).rejects.toThrow("PROVIDER_REACTION_NATION_MISMATCH");
  });
});
