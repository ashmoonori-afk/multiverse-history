import { afterEach, describe, expect, test } from "bun:test";

import { createCampaignResolution } from "../../src/application/campaign-resolution";
import { createCampaignState, parseCampaignState } from "../../src/application/campaign-state";
import { useCampaignStore } from "../../web/src/state/campaign-store";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  useCampaignStore.setState({
    campaign: null,
    bootstrapReady: false,
    startScreenRequested: false,
    stateHash: null,
    error: null,
  });
});

describe("client campaign compatibility", () => {
  test("applies the same defaults as the server boundary", async () => {
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const resolution = createCampaignResolution({
      before: base,
      after: base,
      turn: 1,
      cadence: "month",
      advanceDays: 30,
      orderText: "내정을 정비한다.",
      narrativeKo: "조선 정부는 내정 정비를 시작했다.",
      changedProvinceIds: [],
    });
    const campaign = {
      ...base,
      resolutions: [resolution],
      chatMessages: [
        {
          id: "chat_0_1",
          role: "player",
          speakerNationId: "nat_kor",
          targetNationId: "nat_jpn",
          topic: "general",
          intent: "statement",
          turn: 0,
          date: { year: 1900, quarter: 1 },
          text: "철도 협력을 논의합시다.",
        },
      ],
    };
    globalThis.fetch = Object.assign(
      async () =>
        new Response(
          JSON.stringify({
            campaign,
            stateHash: "a".repeat(64),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      { preconnect: originalFetch.preconnect },
    );

    await useCampaignStore.getState().loadCampaign();
    const loaded = useCampaignStore.getState().campaign;

    expect(useCampaignStore.getState().error).toBeNull();
    expect(Reflect.get(loaded ?? {}, "constructionProjects")).toEqual([]);
    expect(Reflect.get(loaded ?? {}, "worldEvents")).toEqual([]);
    expect(Reflect.get(loaded ?? {}, "nationReactions")).toEqual([]);
    expect(Reflect.get(loaded ?? {}, "lastProgression")).toBeNull();
    expect(Reflect.get(loaded?.resolutions[0] ?? {}, "worldEventIds")).toEqual([]);
    expect(Reflect.get(loaded?.resolutions[0] ?? {}, "reactionIds")).toEqual([]);
    expect(Reflect.get(loaded?.chatMessages[0] ?? {}, "participantNationIds")).toEqual([
      "nat_kor",
      "nat_jpn",
    ]);
    expect(Reflect.get(loaded?.chatMessages[0] ?? {}, "roomId")).toBe("nat_jpn:general");
  });

  test("accepts grounded special-zone treaty clauses from a turn response", async () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const orderText =
      "제주부에 무역특구 지정 입항을 원하는 서구열강을 모집. 필수조항은 무기지원 및 교육장교파견";
    const clauses = ["trade", "port_access", "weapons_support", "officer_training"] as const;
    globalThis.fetch = Object.assign(
      async () =>
        new Response(
          JSON.stringify({
            campaign: base,
            stateHash: "a".repeat(64),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      { preconnect: originalFetch.preconnect },
    );
    await useCampaignStore.getState().loadCampaign();
    globalThis.fetch = Object.assign(
      async () =>
        new Response(
          JSON.stringify({
            campaign: {
              ...base,
              treaties: [
                {
                  id: "try_1_0",
                  proposerNationId: "nat_kor",
                  recipientNationId: "nat_gbr",
                  clauses,
                  status: "proposed",
                  proposedTurn: 1,
                },
              ],
            },
            plan: {
              schemaVersion: 1,
              requestId: "req_web_grounding",
              playerIntents: [
                {
                  type: "diplomacy.propose_treaty",
                  actorNationId: "nat_kor",
                  recipientNationId: "nat_gbr",
                  provinceId: "prv_kor_jeolla",
                  clauses,
                  termsKo: orderText,
                },
              ],
              npcIntents: [
                {
                  type: "military.recruit",
                  actorNationId: "nat_jpn",
                  provinceId: "prv_jpn_kanto",
                  manpower: 2_000,
                },
              ],
              narrative: { ko: "대한제국은 조건부 특구 입항을 제안했다." },
              warnings: [],
            },
            stateHash: "b".repeat(64),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      { preconnect: originalFetch.preconnect },
    );

    // When
    const advanced = await useCampaignStore.getState().advanceTurn(orderText);

    // Then
    expect(advanced).toBe(true);
    expect(useCampaignStore.getState().error).toBeNull();
    expect(useCampaignStore.getState().plan?.playerIntents[0]).toEqual(
      expect.objectContaining({ clauses, termsKo: orderText }),
    );
  });

  test("accepts an open construction kind at both persistence boundaries", async () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const campaign = parseCampaignState({
      ...base,
      constructionProjects: [
        {
          id: "cst_1_0",
          ownerNationId: "nat_kor",
          provinceId: "prv_kor_hanseong",
          kind: "port",
          investedCredits: 60,
          startedTurn: 1,
          status: "active",
        },
      ],
    });
    globalThis.fetch = Object.assign(
      async () =>
        new Response(JSON.stringify({ campaign, stateHash: "a".repeat(64) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      { preconnect: originalFetch.preconnect },
    );

    // When
    await useCampaignStore.getState().loadCampaign();

    // Then
    expect(campaign.constructionProjects[0]?.kind).toBe("port");
    expect(useCampaignStore.getState().campaign?.constructionProjects[0]?.kind).toBe("port");
  });
});
