import { describe, expect, test } from "bun:test";

import {
  parseBasisPoints,
  parseNationId,
  parseSafeInteger,
  parseScenarioId,
} from "../../src/shared/ids";

describe("domain primitive parsers", () => {
  test("parses branded IDs when prefixes are canonical", () => {
    // Given
    const nation = "nat_kor";
    const scenario = "scn_ea1900";

    // When
    const parsedNation = parseNationId(nation);
    const parsedScenario = parseScenarioId(scenario);

    // Then
    expect(String(parsedNation)).toBe(nation);
    expect(String(parsedScenario)).toBe(scenario);
  });

  test("rejects IDs when prefixes or characters are invalid", () => {
    // Given
    const invalidIds = ["KOR", "nation_kor", "nat_KOR", "nat_대한제국"];

    // When
    const parseInvalidIds = () => invalidIds.map((value) => parseNationId(value));

    // Then
    expect(parseInvalidIds).toThrow();
  });

  test("rejects persisted values that are not safe integers", () => {
    // Given
    const invalidValues = [1.25, Number.NaN, Number.POSITIVE_INFINITY];

    // When
    const parseInvalidValues = () => invalidValues.map((value) => parseSafeInteger(value));

    // Then
    expect(parseInvalidValues).toThrow();
  });

  test("accepts basis points only inside zero through ten thousand", () => {
    // Given
    const validValues = [0, 5_800, 10_000];
    const invalidValues = [-1, 10_001];

    // When
    const parsedValues = validValues.map((value) => parseBasisPoints(value));
    const parseInvalidValues = () => invalidValues.map((value) => parseBasisPoints(value));

    // Then
    expect(parsedValues).toEqual(validValues);
    expect(parseInvalidValues).toThrow();
  });
});
