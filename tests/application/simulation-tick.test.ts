import { describe, expect, test } from "bun:test";

import { createCampaignState, parseCampaignState } from "../../src/application/campaign-state";
import { runSimulationTicks } from "../../src/application/simulation-tick";
import { canonicalStringify } from "../../src/shared/canonical-json";

describe("deterministic simulation ticks", () => {
  test("returns the same unchanged state for zero quarters", () => {
    // Given
    const state = createCampaignState("scn_ea1900", "nat_kor");
    const before = canonicalStringify(state);

    // When
    const first = runSimulationTicks({ state, quarters: 0, seedBase: "tick-test" });
    const second = runSimulationTicks({ state, quarters: 0, seedBase: "tick-test" });

    // Then
    expect(first).toEqual(second);
    expect(first.state).toBe(state);
    expect(first.deltas).toEqual({
      nationDeltas: [],
      relationDeltas: [],
      treatyDeltas: [],
      unitDeltas: [],
      regionOwnershipOverrides: [],
    });
    expect(first.events).toEqual([]);
    expect(canonicalStringify(state)).toBe(before);
  });

  test("advances one quarter economy, population, stability, and initial-unit upkeep", () => {
    // Given
    const state = createCampaignState("scn_ea1900", "nat_kor");
    expect(state.units).toHaveLength(19);

    // When
    const result = runSimulationTicks({ state, quarters: 1, seedBase: "tick-test" });
    const beforeNation = state.nations.find((nation) => nation.id === "nat_kor");
    const afterNation = result.state.nations.find((nation) => nation.id === "nat_kor");
    const delta = result.deltas.nationDeltas.find((entry) => entry.nationId === "nat_kor");

    // Then
    expect(afterNation?.treasuryCredits).toBe(377);
    expect(afterNation?.population).toBeGreaterThan(beforeNation?.population ?? 0);
    expect(afterNation?.stabilityBps).toBe(5_750);
    expect(result.state.date).toEqual({ year: 1900, quarter: 2 });
    expect(delta?.treasuryCredits.source).toBe("tick");
    expect(delta?.population?.source).toBe("tick");
    expect(delta?.stabilityBps?.source).toBe("tick");
  });

  test("active trade increases treasury over the identical state without trade", () => {
    // Given
    const withoutTrade = createCampaignState("scn_ea1900", "nat_kor");
    const withTrade = parseCampaignState({
      ...withoutTrade,
      treaties: [
        {
          id: "try_0_0",
          proposerNationId: "nat_kor",
          recipientNationId: "nat_jpn",
          clauses: ["trade"],
          status: "active",
          proposedTurn: 0,
          resolvedTurn: 0,
        },
      ],
    });
    const proposedTrade = parseCampaignState({
      ...withoutTrade,
      treaties: [{ ...withTrade.treaties[0], status: "proposed" }],
    });

    // When
    const plain = runSimulationTicks({ state: withoutTrade, quarters: 1, seedBase: "same" });
    const proposed = runSimulationTicks({ state: proposedTrade, quarters: 1, seedBase: "same" });
    const traded = runSimulationTicks({ state: withTrade, quarters: 1, seedBase: "same" });

    // Then
    expect(
      traded.state.nations.find((nation) => nation.id === "nat_kor")?.treasuryCredits,
    ).toBeGreaterThan(
      plain.state.nations.find((nation) => nation.id === "nat_kor")?.treasuryCredits ?? 0,
    );
    expect(proposed.state.nations.find((nation) => nation.id === "nat_kor")?.treasuryCredits).toBe(
      plain.state.nations.find((nation) => nation.id === "nat_kor")?.treasuryCredits,
    );
  });

  test("combines active-war and empty-treasury stability penalties", () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const state = parseCampaignState({
      ...base,
      nations: base.nations.map((nation) =>
        nation.id === "nat_kor"
          ? { ...nation, treasuryCredits: 0, gdpCredits: 0, taxRateBps: 0 }
          : nation,
      ),
      units: base.units.filter((unit) => unit.ownerNationId !== "nat_kor"),
      wars: [
        {
          id: "war_0_0",
          attackerNationId: "nat_kor",
          targetNationId: "nat_qing",
          status: "active",
          declaredTurn: 0,
        },
      ],
    });

    // When
    const result = runSimulationTicks({ state, quarters: 1, seedBase: "stability" });

    // Then
    expect(result.state.nations.find((nation) => nation.id === "nat_kor")?.stabilityBps).toBe(
      5_450,
    );
  });

  test("rejects an unsafe quarter count", () => {
    // Given
    const state = createCampaignState("scn_ea1900", "nat_kor");

    // When / Then
    expect(() => runSimulationTicks({ state, quarters: 9, seedBase: "tick-test" })).toThrow(
      "INVALID_SIMULATION_QUARTERS",
    );
  });

  test("insolvency removes the minimum largest-upkeep initial unit and emits one event", () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const state = parseCampaignState({
      ...base,
      nations: base.nations.map((nation) =>
        nation.id === "nat_kor"
          ? { ...nation, treasuryCredits: 20, gdpCredits: 0, taxRateBps: 0 }
          : nation,
      ),
    });

    // When
    const result = runSimulationTicks({ state, quarters: 1, seedBase: "insolvent" });
    const koreaUnits = result.state.units.filter((unit) => unit.ownerNationId === "nat_kor");
    const koreaEvents = result.events.filter((event) => event.includes("nat_kor"));

    // Then
    expect(koreaUnits.map((unit) => unit.id)).toEqual(["unt_ea1900_kor_2"]);
    expect(koreaEvents).toHaveLength(1);
    expect(result.deltas.unitDeltas).toContainEqual(
      expect.objectContaining({ unitId: "unt_ea1900_kor_1", after: null, source: "tick" }),
    );
  });

  test("applies exact five-percent attrition to an unsupplied unit in enemy territory", () => {
    // Given
    const base = createCampaignState("scn_ea1900", "nat_kor");
    const state = parseCampaignState({
      ...base,
      wars: [
        {
          id: "war_0_0",
          attackerNationId: "nat_kor",
          targetNationId: "nat_qing",
          status: "active",
          declaredTurn: 0,
        },
      ],
      units: base.units.map((unit) =>
        unit.id === "unt_ea1900_kor_2" ? { ...unit, provinceId: "prv_qing_manchuria" } : unit,
      ),
    });

    // When
    const first = runSimulationTicks({ state, quarters: 1, seedBase: "supply" });
    const second = runSimulationTicks({ state, quarters: 1, seedBase: "supply" });

    // Then
    expect(first).toEqual(second);
    expect(first.state.units.find((unit) => unit.id === "unt_ea1900_kor_2")?.manpower).toBe(17_100);
    expect(first.deltas.unitDeltas).toContainEqual(
      expect.objectContaining({
        unitId: "unt_ea1900_kor_2",
        before: expect.objectContaining({ manpower: 18_000 }),
        after: expect.objectContaining({ manpower: 17_100 }),
        source: "tick",
      }),
    );
  });
});
