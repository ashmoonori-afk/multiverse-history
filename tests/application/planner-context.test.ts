import { describe, expect, test } from "bun:test";
import { createCampaignState } from "../../src/application/campaign-state";
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
});
