import { describe, expect, test } from "bun:test";

import { getScenarioById, listScenarios } from "../../src/domain/scenario/registry";
import { parseNationId, parseScenarioId } from "../../src/shared/ids";

describe("1900 East Asia scenario", () => {
  test("loads an immutable scenario with the Korean Empire start contract", () => {
    // Given
    const scenarioId = "scn_ea1900";

    // When
    const scenario = getScenarioById(scenarioId);
    const korea = scenario.nations.find((nation) => nation.id === "nat_kor");

    // Then
    expect(Object.isFrozen(scenario)).toBe(true);
    expect(Object.isFrozen(scenario.nations)).toBe(true);
    expect(scenario.titleKo).toBe("1900 동아시아");
    expect(scenario.year).toBe(1900);
    expect(scenario.quarter).toBe(1);
    expect(korea).toEqual({
      id: parseNationId("nat_kor"),
      nameKo: "대한제국",
      capitalLabelKo: "한성 수도",
      legalActions: ["economy.invest", "diplomacy.propose_treaty", "military.recruit"],
      treasuryCredits: 240,
      gdpCredits: 1_200,
      taxRateBps: 1_500,
      stabilityBps: 5_800,
      population: 17_082_000,
      infrastructureBps: 2_400,
    });
  });

  test("keeps nation population equal to owned province population", () => {
    // Given
    const scenario = getScenarioById("scn_ea1900");

    // When
    const totals = new Map<string, number>();
    for (const province of scenario.provinces) {
      const current = totals.get(province.ownerNationId) ?? 0;
      totals.set(province.ownerNationId, current + province.population);
    }

    // Then
    for (const nation of scenario.nations) {
      expect(totals.get(nation.id)).toBe(nation.population);
    }
  });

  test("contains unique IDs and required initial relations", () => {
    // Given
    const scenario = getScenarioById("scn_ea1900");

    // When
    const nationIds = scenario.nations.map((nation) => nation.id);
    const provinceIds = scenario.provinces.map((province) => province.id);
    const relationValues = Object.fromEntries(
      scenario.relations
        .filter((relation) => relation.fromNationId === "nat_kor")
        .map((relation) => [relation.toNationId, relation.value]),
    );

    // Then
    expect(new Set(nationIds).size).toBe(nationIds.length);
    expect(new Set(provinceIds).size).toBe(provinceIds.length);
    expect(relationValues).toEqual({
      nat_jpn: -500,
      nat_qing: 1_000,
      nat_rus: 250,
      nat_gbr: 200,
      nat_usa: 300,
    });
  });

  test("lists the scenario from the public registry", () => {
    // Given
    const expectedId = "scn_ea1900";

    // When
    const scenarioIds = listScenarios().map((scenario) => scenario.id);

    // Then
    expect(scenarioIds).toContain(parseScenarioId(expectedId));
  });
});
