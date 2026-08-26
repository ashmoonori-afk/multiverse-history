import { describe, expect, test } from "bun:test";

import {
  createPlayableNationStart,
  listBuiltInScenarioMetadata,
  listCanonicalCountries,
  validateScenarioPackageMetadata,
} from "../../src/domain/scenario/catalog";
import { listScenarios } from "../../src/domain/scenario/registry";

describe("global scenario contract", () => {
  test("provides a unique canonical registry for every ISO country", () => {
    // Given
    const minimumCountryCount = 249;

    // When
    const countries = listCanonicalCountries();
    const alpha2Codes = countries.map((country) => country.alpha2);
    const numericCodes = countries.map((country) => country.numericCode);

    // Then
    expect(countries.length).toBeGreaterThanOrEqual(minimumCountryCount);
    expect(new Set(alpha2Codes).size).toBe(countries.length);
    expect(new Set(numericCodes).size).toBe(countries.length);
    expect(alpha2Codes).toContain("KR");
    expect(alpha2Codes).toContain("BR");
    expect(alpha2Codes).toContain("AD");
    expect(alpha2Codes).toContain("TV");
  });

  test("makes every built-in scenario playable for every canonical country", () => {
    // Given
    const canonicalIds = new Set(listCanonicalCountries().map((country) => country.id));

    // When
    const scenarios = listScenarios();

    // Then
    expect(scenarios).toHaveLength(listBuiltInScenarioMetadata().length);
    for (const scenario of scenarios) {
      const playableIds = new Set(scenario.playerNationIds);
      const nationIds = new Set(scenario.nations.map((nation) => nation.id));
      for (const nationId of canonicalIds) {
        expect(playableIds.has(nationId)).toBe(true);
        expect(nationIds.has(nationId)).toBe(true);
      }
      for (const nationId of canonicalIds) {
        expect(scenario.provinces.some((province) => province.ownerNationId === nationId)).toBe(
          true,
        );
      }
    }
  });

  test("creates a playable neutral fallback for representative countries", () => {
    // Given
    const representativeCountries = ["KR", "BR", "CA", "AD", "TV"];

    // When
    const starts = representativeCountries.map((alpha2) => createPlayableNationStart(alpha2));

    // Then
    for (const start of starts) {
      expect(start.capitalLabelKo.length).toBeGreaterThan(0);
      expect(start.treasuryCredits).toBeGreaterThan(0);
      expect(start.stabilityBps).toBeGreaterThanOrEqual(0);
      expect(start.legalActions.length).toBeGreaterThan(0);
    }
  });

  test("accepts provenance-bearing metadata and rejects missing licenses", () => {
    // Given
    const validMetadata = {
      schema: "multiverse-history-scenario/1",
      id: "scn_bronze_1200bc",
      titleKo: "청동기 붕괴",
      era: "ancient",
      genre: "historical",
      year: -1200,
      licenseSpdx: "CC0-1.0",
      authors: ["Multiverse History Team"],
      sourceManifest: ["public-domain historical facts"],
      assetManifest: ["original generated geometry"],
    };
    const invalidMetadata = { ...validMetadata, licenseSpdx: "" };

    // When
    const parsed = validateScenarioPackageMetadata(validMetadata);
    const parseInvalid = () => validateScenarioPackageMetadata(invalidMetadata);

    // Then
    expect(parsed.titleKo).toBe("청동기 붕괴");
    expect(parseInvalid).toThrow();
  });

  test("rejects unknown schema versions before catalog mutation", () => {
    // Given
    const unsupported = {
      schema: "legacy-scenario-bundle/2",
      id: "scn_external",
      titleKo: "외부 시나리오",
      era: "unknown",
      genre: "unknown",
      year: 0,
      licenseSpdx: "NOASSERTION",
      authors: ["unknown"],
      sourceManifest: [],
      assetManifest: [],
    };

    // When
    const parseUnsupported = () => validateScenarioPackageMetadata(unsupported);

    // Then
    expect(parseUnsupported).toThrow();
  });

  test("ships a diverse independently authored built-in catalog", () => {
    // Given
    const requiredScenarioIds = [
      "scn_bronze_1200bc",
      "scn_classical_117",
      "scn_medieval_1200",
      "scn_steppe_1300",
      "scn_trade_1650",
      "scn_ea1900",
      "scn_world_1939",
      "scn_coldwar_1962",
      "scn_modern",
      "scn_reconstruction_2281",
    ];

    // When
    const scenarios = listBuiltInScenarioMetadata();
    const ids = scenarios.map((scenario) => String(scenario.id));
    const eras = new Set(scenarios.map((scenario) => scenario.era));
    const genres = new Set(scenarios.map((scenario) => scenario.genre));

    // Then
    expect(ids).toEqual(requiredScenarioIds);
    expect(eras.size).toBeGreaterThanOrEqual(6);
    expect(genres.size).toBeGreaterThanOrEqual(6);
    for (const scenario of scenarios) {
      expect(scenario.licenseSpdx).toBe("CC0-1.0");
      expect(scenario.sourceManifest.length).toBeGreaterThan(0);
      expect(scenario.assetManifest.length).toBeGreaterThan(0);
    }
  });

  test("gives every canonical country a playable start in every built-in", () => {
    // Given
    const scenarios = listBuiltInScenarioMetadata();
    const countries = listCanonicalCountries();

    // When
    const playableMatrix = scenarios.flatMap((scenario) =>
      countries.map((country) => ({
        scenarioId: scenario.id,
        start: createPlayableNationStart(country.alpha2),
      })),
    );

    // Then
    expect(playableMatrix.length).toBe(scenarios.length * countries.length);
    for (const entry of playableMatrix) {
      expect(entry.start.legalActions.length).toBeGreaterThan(0);
      expect(entry.start.treasuryCredits).toBeGreaterThan(0);
    }
  });
});
