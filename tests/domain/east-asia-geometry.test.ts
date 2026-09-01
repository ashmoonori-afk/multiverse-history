import { describe, expect, test } from "bun:test";

import {
  eastAsiaProvinceCollection,
  eastAsiaProvinceMap,
} from "../../web/src/features/map/east-asia-map";

interface SourcedFeatureProperties {
  readonly provinceId?: unknown;
  readonly sourceIso?: unknown;
  readonly sourceNames?: unknown;
}

describe("East Asia sourced region geometry", () => {
  test("maps dissolved licensed ADM1 geometry onto every campaign province", () => {
    const features = eastAsiaProvinceCollection.features;
    const campaignIds = new Set(eastAsiaProvinceMap.map((province) => province.id));
    const representedIds = new Set<string>();

    expect(features).toHaveLength(92);
    for (const feature of features) {
      const properties = feature.properties as SourcedFeatureProperties;
      expect(properties.sourceIso).toBeArray();
      expect(properties.sourceNames).toBeArray();
      expect(properties.provinceId).toBeString();
      expect(feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon").toBe(
        true,
      );
      representedIds.add(String(properties.provinceId));
    }

    expect(representedIds).toEqual(campaignIds);
  });
});
