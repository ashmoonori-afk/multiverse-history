import { describe, expect, test } from "bun:test";

import { eastAsiaProvinceCollection } from "../../web/src/features/map/east-asia-map";

interface DisplayRegionProperties {
  readonly provinceId?: unknown;
  readonly sourceNames?: unknown;
  readonly labelAnchor?: unknown;
  readonly bounds?: unknown;
}

describe("East Asia dissolved display geometry", () => {
  test("ships one valid display feature per campaign province", () => {
    const features = eastAsiaProvinceCollection.features;
    const provinceIds = new Set<string>();

    expect(features).toHaveLength(25);
    for (const feature of features) {
      const properties = feature.properties as unknown as DisplayRegionProperties;
      expect(properties.provinceId).toBeString();
      expect(properties.sourceNames).toBeArray();
      expect(properties.labelAnchor).toBeArray();
      expect(properties.bounds).toBeArray();
      expect(feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon").toBe(
        true,
      );
      provinceIds.add(String(properties.provinceId));
    }

    expect(provinceIds.size).toBe(25);
  });
});
