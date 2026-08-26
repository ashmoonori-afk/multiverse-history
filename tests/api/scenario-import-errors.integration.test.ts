import { describe, expect, test } from "bun:test";

import { createGameApp } from "../../src/api/app";
import { hashCanonical } from "../../src/shared/canonical-json";

const packageContent = () => ({
  schemaVersion: 1 as const,
  id: "scn_imported_demo",
  titleKo: "가져온 실험 시나리오",
  era: "modern",
  genre: "historical",
  year: 1950,
  licenseSpdx: "CC0-1.0",
  authors: ["Multiverse History Player"],
  nations: [{ id: "nat_bra", countryId: "nat_bra", nameKo: "브라질" }],
  regions: [
    {
      id: "prv_bra_imported",
      ownerNationId: "nat_bra",
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    },
  ],
  assets: [{ id: "map", source: "inline" as const, licenseSpdx: "CC0-1.0" }],
});

const validPackage = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
  const content = { ...packageContent(), ...overrides };
  return { ...content, canonicalHash: hashCanonical(content) };
};

describe("scenario package import error boundary", () => {
  test("rejects every malformed package without changing catalog or campaign hashes", async () => {
    const app = createGameApp();
    await app.request("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: "scn_ea1900", playerNationId: "nat_kor" }),
    });
    const catalogBeforeResponse = await app.request("/api/catalog");
    const catalogBefore = hashCanonical(await catalogBeforeResponse.json());
    const campaignHashBeforeResponse = await app.request("/api/campaign/state-hash");
    const campaignHashBefore = (await campaignHashBeforeResponse.json()) as {
      stateHash: string;
    };

    const duplicateNations = [
      { id: "nat_bra", countryId: "nat_bra", nameKo: "브라질" },
      { id: "nat_bra", countryId: "nat_bra", nameKo: "브라질 복제" },
    ];
    const invalidGeometry = [
      {
        id: "prv_bra_imported",
        ownerNationId: "nat_bra",
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
          ],
        },
      },
    ];
    const cases = [
      { name: "empty", body: "", status: 400, code: "invalid_request" },
      { name: "malformed", body: "{", status: 400, code: "invalid_request" },
      {
        name: "oversized",
        body: JSON.stringify(validPackage({ history: "x".repeat(1_100_000) })),
        status: 413,
        code: "scenario_package_too_large",
      },
      {
        name: "hash-tampered",
        body: JSON.stringify({ ...validPackage(), canonicalHash: "0".repeat(64) }),
        status: 422,
        code: "scenario_package_hash_mismatch",
      },
      {
        name: "unknown-country",
        body: JSON.stringify(
          validPackage({
            nations: [{ id: "nat_bra", countryId: "nat_zzz", nameKo: "브라질" }],
          }),
        ),
        status: 422,
        code: "scenario_unknown_country",
      },
      {
        name: "duplicate-id",
        body: JSON.stringify(validPackage({ nations: duplicateNations })),
        status: 422,
        code: "scenario_duplicate_nation_id",
      },
      {
        name: "invalid-geometry",
        body: JSON.stringify(validPackage({ regions: invalidGeometry })),
        status: 422,
        code: "scenario_invalid_geometry",
      },
      {
        name: "unlicensed-external-asset",
        body: JSON.stringify(
          validPackage({
            assets: [{ id: "map", source: "external", licenseSpdx: "UNLICENSED" }],
          }),
        ),
        status: 422,
        code: "scenario_unlicensed_external_asset",
      },
    ] as const;

    for (const scenarioCase of cases) {
      const response = await app.request("/api/catalog/scenarios/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: scenarioCase.body,
      });
      expect(response.status, scenarioCase.name).toBe(scenarioCase.status);
      const body = (await response.json()) as {
        error?: { code: string; recoverable: boolean };
      };
      expect(body.error?.code, scenarioCase.name).toBe(scenarioCase.code);
      expect(body.error?.recoverable, scenarioCase.name).toBe(true);
      const catalogAfterResponse = await app.request("/api/catalog");
      const catalogAfter = hashCanonical(await catalogAfterResponse.json());
      expect(catalogAfter, scenarioCase.name).toBe(catalogBefore);
      const campaignHashAfterResponse = await app.request("/api/campaign/state-hash");
      expect(
        (await campaignHashAfterResponse.json()) as { stateHash: string },
        scenarioCase.name,
      ).toEqual(campaignHashBefore);
    }
    const catalogResponse = await app.request("/api/catalog");
    const catalog = (await catalogResponse.json()) as {
      scenarios: readonly { id: string }[];
    };
    expect(catalog.scenarios.some((scenario) => scenario.id === "scn_imported_demo")).toBe(false);
  });
});
