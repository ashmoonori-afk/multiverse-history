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
  test("accepts v2 lifecycle contracts and defaults legacy resolution sources", async () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const legacyResolution = createCampaignResolution({
      before: base,
      after: {
        ...base,
        nations: base.nations.map((nation) =>
          nation.id === "nat_kor" ? { ...nation, stabilityBps: nation.stabilityBps - 1 } : nation,
        ),
      },
      turn: 1,
      cadence: "quarter",
      advanceDays: 91,
      orderText: "정책을 조정한다.",
      narrativeKo: "정책이 조정되었다.",
      changedProvinceIds: [],
    });
    const legacyResolutionWithoutSource = JSON.parse(JSON.stringify(legacyResolution));
    Reflect.deleteProperty(legacyResolutionWithoutSource.nationDeltas[0].stabilityBps, "source");
    Reflect.deleteProperty(legacyResolutionWithoutSource, "unitDeltas");
    const campaign = {
      ...base,
      treaties: [
        {
          id: "try_1_0",
          proposerNationId: "nat_kor",
          recipientNationId: "nat_jpn",
          clauses: ["trade"],
          status: "terminated",
          proposedTurn: 0,
          resolvedTurn: 1,
          terminatedTurn: 2,
        },
      ],
      wars: [
        {
          id: "war_1_0",
          attackerNationId: "nat_kor",
          targetNationId: "nat_jpn",
          status: "ended",
          declaredTurn: 1,
          endedTurn: 2,
        },
        {
          attackerNationId: "nat_qing",
          targetNationId: "nat_jpn",
          declaredTurn: 3,
        },
      ],
      resolutions: [legacyResolutionWithoutSource],
    };
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
    const loaded = useCampaignStore.getState().campaign;

    // Then
    expect(useCampaignStore.getState().error).toBeNull();
    expect(loaded?.nations.find((nation) => nation.id === "nat_kor")?.capitalProvinceId).toBe(
      "prv_kor_hanseong",
    );
    expect(loaded?.treaties[0]?.status).toBe("terminated");
    expect(loaded?.wars[0]?.status).toBe("ended");
    expect(loaded?.wars[1]).toEqual(expect.objectContaining({ id: "war_3_1", status: "active" }));
    expect(loaded?.resolutions[0]?.nationDeltas[0]?.stabilityBps?.source).toBe("policy");
    expect(loaded?.resolutions[0]?.unitDeltas).toEqual([]);
  });

  test("accepts v2 nation profiles and province adjacency metadata", async () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const campaign = {
      ...base,
      nations: base.nations.map((nation, index) =>
        index === 0
          ? {
              ...nation,
              governmentKo: "입헌군주제",
              tags: ["reformist"],
              manpowerPool: 10_000,
              profile: {
                goalsKo: ["자주독립"],
                personalityKo: "신중한 개혁가",
                rivalNationIds: ["nat_jpn"],
                allyNationIds: ["nat_gbr"],
              },
            }
          : nation,
      ),
      provinces: base.provinces.map((province, index) =>
        index === 0
          ? {
              ...province,
              nameKo: "한성",
              adjacentProvinceIds: ["prv_kor_jeolla"],
              isCapital: true,
              isPort: false,
              terrain: "plains",
              developmentBps: 5_000,
            }
          : province,
      ),
      worldEvents: [
        {
          id: "evt_1_1",
          kind: "political",
          importance: "major",
          occurredAtElapsedDays: 0,
          turn: 0,
          date: base.date,
          actorNationIds: ["nat_kor"],
          affectedNationIds: ["nat_kor"],
          headlineKo: "개혁 발표",
          summaryKo: "대한제국이 새 개혁안을 발표했다.",
          impacts: {
            regionTransfers: [
              {
                regionId: "prv_kor_hanseong",
                fromNationId: "nat_kor",
                toNationId: "nat_jpn",
                sourceEventId: "evt_1_0",
              },
            ],
            nationChanges: [{ nationId: "nat_kor", stabilityChange: 100 }],
            relationChanges: [{ fromNationId: "nat_kor", toNationId: "nat_jpn", delta: -100 }],
            unitOps: [
              {
                op: "move",
                unitId: "unt_1_0",
                provinceId: "prv_kor_hanseong",
              },
            ],
          },
          provenance: "player_divergence",
          regionIds: ["prv_kor_hanseong"],
          sourceInputIds: ["req_1"],
        },
      ],
    };
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
    expect(useCampaignStore.getState().error).toBeNull();
    expect(useCampaignStore.getState().campaign?.nations[0]?.profile?.goalsKo).toEqual([
      "자주독립",
    ]);
    expect(useCampaignStore.getState().campaign?.provinces[0]?.adjacentProvinceIds).toEqual([
      "prv_kor_jeolla",
    ]);
    expect(useCampaignStore.getState().campaign?.worldEvents[0]?.provenance).toBe(
      "player_divergence",
    );
    expect(
      useCampaignStore.getState().campaign?.worldEvents[0]?.impacts?.regionTransfers[0],
    ).toEqual(expect.objectContaining({ regionId: "prv_kor_hanseong", toNationId: "nat_jpn" }));
  });

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
              schemaVersion: 2,
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

  test("rejects malformed identifiers mirrored from the server boundary", async () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const treatyIntent = {
      type: "treaty.respond",
      treatyId: "try_1_0",
      decision: "accept",
      actorNationId: "nat_kor",
    } as const;
    const warIntent = {
      type: "war.peace",
      warId: "war_1_0",
      terms: [],
    } as const;
    const unitIntent = {
      type: "unit.move",
      unitId: "unt_1_0",
      toProvinceId: "prv_kor_hanseong",
    } as const;
    const plan = {
      schemaVersion: 2,
      requestId: "req_client_ids",
      playerIntents: [treatyIntent, warIntent, unitIntent],
      npcIntents: [],
      narrative: { ko: "식별자를 검증한다." },
      warnings: [],
    } as const;
    const malformedCampaigns: readonly unknown[] = [
      { ...base, lastPlan: { ...plan, requestId: "bad" } },
      {
        ...base,
        lastPlan: {
          ...plan,
          playerIntents: [{ ...treatyIntent, treatyId: "bad" }, warIntent, unitIntent],
        },
      },
      {
        ...base,
        lastPlan: {
          ...plan,
          playerIntents: [treatyIntent, { ...warIntent, warId: "bad" }, unitIntent],
        },
      },
      {
        ...base,
        lastPlan: {
          ...plan,
          playerIntents: [treatyIntent, warIntent, { ...unitIntent, unitId: "bad" }],
        },
      },
      {
        ...base,
        lastPlan: {
          ...plan,
          playerIntents: [treatyIntent, warIntent, { ...unitIntent, toProvinceId: "bad" }],
        },
      },
      {
        ...base,
        lastPlan: {
          ...plan,
          playerIntents: [{ ...treatyIntent, actorNationId: "bad" }, warIntent, unitIntent],
        },
      },
      {
        ...base,
        worldEvents: [
          {
            id: "bad",
            kind: "political",
            importance: "major",
            occurredAtElapsedDays: 0,
            turn: 0,
            date: base.date,
            actorNationIds: ["nat_kor"],
            affectedNationIds: ["nat_kor"],
            headlineKo: "개혁 발표",
            summaryKo: "대한제국이 새 개혁안을 발표했다.",
          },
        ],
      },
    ];

    // When / Then
    for (const campaign of malformedCampaigns) {
      globalThis.fetch = Object.assign(
        async () =>
          new Response(JSON.stringify({ campaign, stateHash: "a".repeat(64) }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        { preconnect: originalFetch.preconnect },
      );
      await useCampaignStore.getState().loadCampaign();
      expect(useCampaignStore.getState().error).not.toBeNull();
    }
  });
});
