import { afterEach, describe, expect, test } from "bun:test";

import { createCampaignResolution } from "../../src/application/campaign-resolution";
import { createCampaignState } from "../../src/application/campaign-state";
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
});
