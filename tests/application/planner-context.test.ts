import { describe, expect, test } from "bun:test";
import { type CampaignState, createCampaignState } from "../../src/application/campaign-state";
import { buildPlannerStateJson } from "../../src/application/planner-context";
import { canonicalStringify } from "../../src/shared/canonical-json";

describe("planner context slimming", () => {
  test("keeps the player and major nations while dropping the minor-nation bulk", () => {
    // Given: the full 251-nation campaign
    const state = createCampaignState("scn_ea1900", "nat_kor");

    // When
    const json = buildPlannerStateJson(state);
    const parsed = JSON.parse(json) as {
      playerNation: { id: string };
      majorNations: { id: string }[];
      provinces: { id: string }[];
      otherNationCount: number;
    };

    // Then: player + the ten explicit majors stay, the ~240 minors are folded
    // into a count instead of bloating the prompt.
    expect(parsed.playerNation.id).toBe("nat_kor");
    const majorIds = parsed.majorNations.map((nation) => nation.id);
    expect(majorIds).toContain("nat_jpn");
    expect(majorIds).toContain("nat_gbr");
    expect(majorIds.length).toBeLessThanOrEqual(12);
    expect(majorIds).not.toContain("nat_and");
    expect(parsed.otherNationCount).toBeGreaterThan(200);
    expect(parsed.provinces.some((province) => province.id === "prv_kor_hanseong")).toBe(true);
    expect(parsed.provinces.some((province) => province.id === "prv_and_adm0")).toBe(false);

    // And the payload is an order of magnitude smaller than the full state.
    expect(json.length).toBeLessThan(canonicalStringify(state).length / 5);
  });

  test("attaches each major's profile and active diplomatic context", () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const state: CampaignState = Object.freeze({
      ...base,
      wars: Object.freeze([
        {
          id: "war_0_0",
          attackerNationId: "nat_jpn",
          targetNationId: "nat_rus",
          status: "active" as const,
          declaredTurn: 0,
        },
      ]),
      treaties: Object.freeze([
        {
          id: "try_jpn_gbr_active",
          proposerNationId: "nat_jpn",
          recipientNationId: "nat_gbr",
          clauses: Object.freeze(["trade"]),
          status: "active" as const,
          proposedTurn: 0,
        },
        {
          id: "try_jpn_qing_proposed",
          proposerNationId: "nat_jpn",
          recipientNationId: "nat_qing",
          clauses: Object.freeze(["trade"]),
          status: "proposed" as const,
          proposedTurn: 0,
        },
      ]),
      worldEvents: Object.freeze(
        [1, 2, 3, 4].map((index) => ({
          id: `evt_jpn_${index}`,
          kind: "diplomatic" as const,
          importance: "minor" as const,
          occurredAtElapsedDays: index,
          turn: index,
          date: Object.freeze({ year: 1900, quarter: 1 }),
          actorNationIds: Object.freeze(index % 2 === 0 ? ["nat_jpn"] : ["nat_gbr"]),
          affectedNationIds: Object.freeze(index % 2 === 0 ? ["nat_gbr"] : ["nat_jpn"]),
          headlineKo: `일본 관련 사건 ${index}`,
          summaryKo: `일본과 영국이 관련된 사건 ${index}`,
        })),
      ),
    });

    // When
    const parsed = JSON.parse(buildPlannerStateJson(state)) as {
      majorNations: {
        id: string;
        profile?: { goalsKo: string[] };
        activeWars: {
          id: string;
          attackerNationId: string;
          targetNationId: string;
          status: "active" | "ended";
          declaredTurn: number;
        }[];
        activeTreaties: { id: string }[];
        recentWorldEvents: { id: string }[];
      }[];
    };
    const japan = parsed.majorNations.find((nation) => nation.id === "nat_jpn");

    // Then
    expect(japan?.profile?.goalsKo.length).toBeGreaterThan(0);
    expect(japan?.activeWars).toEqual([
      {
        id: "war_0_0",
        attackerNationId: "nat_jpn",
        targetNationId: "nat_rus",
        status: "active",
        declaredTurn: 0,
      },
    ]);
    expect(japan?.activeTreaties.map((treaty) => treaty.id)).toEqual(["try_jpn_gbr_active"]);
    expect(japan?.recentWorldEvents.map((event) => event.id)).toEqual([
      "evt_jpn_2",
      "evt_jpn_3",
      "evt_jpn_4",
    ]);
  });
});
