import { describe, expect, test } from "bun:test";

import { buildOpenHistoriaMapData } from "../../web/src/features/map/open-historia-map-data";

const HANSEONG = "prv_kor_hanseong";

const nationNames = new Map([
  ["nat_kor", "대한제국"],
  ["nat_jpn", "일본제국"],
]);

const resolutionWith = (
  overrides: readonly { regionId: string; toNationId: string; fromNationId: string }[],
) => ({
  worldImpact: {
    changedNationIds: [],
    changedProvinceIds: overrides.map((entry) => entry.regionId),
    summaryKo: "요약",
    regionOwnershipOverrides: overrides,
  },
});

describe("disputed territory overlays", () => {
  test("marks a transferred province disputed with the previous owner's claim", () => {
    // Given: Hanseong was transferred from Korea to Japan in the latest resolution
    const campaign = {
      provinces: [{ id: HANSEONG, ownerNationId: "nat_jpn", population: 1_200_000 }],
      units: [],
      constructionProjects: [],
      resolutions: [
        resolutionWith([{ regionId: HANSEONG, toNationId: "nat_jpn", fromNationId: "nat_kor" }]),
      ],
    };

    // When
    const data = buildOpenHistoriaMapData(campaign as never, nationNames);
    const region = data.regions.features.find(
      (feature) => feature.properties.provinceId === HANSEONG,
    );

    // Then: the region is disputed and carries the claimant (former owner) identity
    expect(region?.properties.disputed).toBe(true);
    expect(region?.properties.claimantNationId).toBe("nat_kor");
    expect(region?.properties.claimantColor).toBe("#22c7a9");
  });

  test("keeps an untouched province undisputed", () => {
    const campaign = {
      provinces: [{ id: HANSEONG, ownerNationId: "nat_kor", population: 1_200_000 }],
      units: [],
      constructionProjects: [],
      resolutions: [],
    };

    const data = buildOpenHistoriaMapData(campaign as never, nationNames);
    const region = data.regions.features.find(
      (feature) => feature.properties.provinceId === HANSEONG,
    );

    expect(region?.properties.disputed).toBe(false);
    expect(region?.properties.claimantNationId).toBe("");
  });

  test("clears the dispute once the claimant retakes the province", () => {
    // Given: transferred away then retaken — the latest override matches the
    // current owner's rival no longer, so the claim collapses
    const campaign = {
      provinces: [{ id: HANSEONG, ownerNationId: "nat_kor", population: 1_200_000 }],
      units: [],
      constructionProjects: [],
      resolutions: [
        resolutionWith([{ regionId: HANSEONG, toNationId: "nat_jpn", fromNationId: "nat_kor" }]),
        resolutionWith([{ regionId: HANSEONG, toNationId: "nat_kor", fromNationId: "nat_jpn" }]),
      ],
    };

    const data = buildOpenHistoriaMapData(campaign as never, nationNames);
    const region = data.regions.features.find(
      (feature) => feature.properties.provinceId === HANSEONG,
    );

    // The former owner (nat_jpn) now claims it back — dispute persists but with
    // the NEW claimant, proving the derivation follows the latest transfer.
    expect(region?.properties.disputed).toBe(true);
    expect(region?.properties.claimantNationId).toBe("nat_jpn");
  });
});
