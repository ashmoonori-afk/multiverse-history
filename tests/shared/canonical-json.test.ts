import { describe, expect, test } from "bun:test";

import { canonicalStringify, hashCanonical } from "../../src/shared/canonical-json";

describe("canonical JSON and hashing", () => {
  test("sorts object keys recursively while retaining array order", () => {
    // Given
    const first = { z: 1, nested: { b: 2, a: 1 }, list: ["대한제국", "일본제국"] };
    const reordered = { list: ["대한제국", "일본제국"], nested: { a: 1, b: 2 }, z: 1 };
    const reversedArray = { z: 1, nested: { b: 2, a: 1 }, list: ["일본제국", "대한제국"] };

    // When
    const firstJson = canonicalStringify(first);
    const reorderedJson = canonicalStringify(reordered);

    // Then
    expect(reorderedJson).toBe(firstJson);
    expect(hashCanonical(reordered)).toBe(hashCanonical(first));
    expect(hashCanonical(reversedArray)).not.toBe(hashCanonical(first));
  });

  test("hashes UTF-8 Korean text to stable lowercase SHA-256", () => {
    // Given
    const state = { chronicle: "대한제국은 철도망을 확충했다.", turn: 1 };

    // When
    const hash = hashCanonical(state);

    // Then
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashCanonical(state)).toBe(hash);
  });

  test("rejects non-canonical runtime values", () => {
    // Given
    const invalidValues = [
      { value: 1.5 },
      { value: Number.NaN },
      { value: Number.POSITIVE_INFINITY },
      { value: undefined },
      { value: 1n },
      { value: () => 1 },
    ];

    // When
    const serializeInvalid = () => invalidValues.map(canonicalStringify);

    // Then
    expect(serializeInvalid).toThrow();
  });
});
