import { describe, expect, test } from "bun:test";

import { listBuiltInScenarioMetadata } from "../../src/domain/scenario/catalog";
import {
  historicalBasemapSnapshot,
  historicalBasemapUrl,
  historicalPolityId,
  historicalProvinceId,
  parseHistoricalBasemap,
} from "../../src/shared/historical-map-contract";
import { convertHistoricalBasemap } from "../../web/src/features/map/historical-map";
import {
  historicalBasemapSnapshot as clientHistoricalBasemapSnapshot,
  historicalBasemapUrl as clientHistoricalBasemapUrl,
  historicalPolityId as clientHistoricalPolityId,
  historicalProvinceId as clientHistoricalProvinceId,
  parseHistoricalBasemap as parseClientHistoricalBasemap,
} from "../../web/src/features/map/historical-map-contract";
import { buildOpenHistoriaMapData } from "../../web/src/features/map/open-historia-map-data";
import { regionFillLayer } from "../../web/src/features/map/open-historia-map-style";

describe("historical MapLibre collection", () => {
  test("keeps the browser mirror aligned with the server contract", () => {
    // Given
    const basemap = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { NAME: "Cote d'Ivoire", SUBJECTO: null, source: "GPL-3.0" },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [-8, 5],
                [-2, 5],
                [-2, 11],
                [-8, 5],
              ],
            ],
          },
        },
      ],
    };
    const invalidBasemap = { ...basemap, features: [{ ...basemap.features[0], geometry: null }] };

    // When / Then
    for (const { id } of listBuiltInScenarioMetadata()) {
      expect(clientHistoricalBasemapSnapshot(id)).toBe(historicalBasemapSnapshot(id));
      expect(clientHistoricalBasemapUrl(id)).toBe(historicalBasemapUrl(id));
    }
    for (const name of ["Roman Empire", "Cote d'Ivoire", "대한제국", ""] as const) {
      expect(clientHistoricalPolityId(name)).toBe(historicalPolityId(name));
      expect(clientHistoricalProvinceId(name)).toBe(historicalProvinceId(name));
    }
    expect(parseClientHistoricalBasemap(basemap)).toEqual(parseHistoricalBasemap(basemap));
    expect(() => parseClientHistoricalBasemap(invalidBasemap)).toThrow();
    expect(() => parseHistoricalBasemap(invalidBasemap)).toThrow();
  });

  test("converts named territories into campaign-compatible map features", () => {
    const collection = convertHistoricalBasemap({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { NAME: "Roman Empire" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [10, 40],
                [20, 40],
                [20, 50],
                [10, 40],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { NAME: null },
          geometry: {
            type: "Polygon",
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
        {
          type: "Feature",
          properties: { NAME: "Roman Empire" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [25, 40],
                [26, 40],
                [26, 41],
                [25, 40],
              ],
            ],
          },
        },
      ],
    });

    expect(collection.features).toHaveLength(1);
    const feature = collection.features[0];
    expect(feature?.properties.provinceId).toBe(historicalProvinceId("Roman Empire"));
    expect(feature?.properties.ownerNationId).toBe(historicalPolityId("Roman Empire"));
    expect(feature?.properties.sourceNames).toEqual(["Roman Empire"]);
    expect(feature?.properties.bounds).toEqual([10, 40, 26, 50]);
    expect(feature?.properties.labelAnchor).toEqual([15, 45]);
    expect(feature?.geometry.type).toBe("MultiPolygon");
  });

  test("uses high-contrast political colors over shaded relief", () => {
    const converted = convertHistoricalBasemap({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { NAME: "Great Khanate" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [80, 40],
                [120, 40],
                [120, 60],
                [80, 40],
              ],
            ],
          },
        },
      ],
    });
    const ownerNationId = historicalPolityId("Great Khanate");
    const provinceId = historicalProvinceId("Great Khanate");
    const mapData = buildOpenHistoriaMapData(
      {
        provinces: [{ id: provinceId, ownerNationId, population: 80_000_000 }],
        resolutions: [],
        units: [],
        constructionProjects: [],
      },
      new Map([[ownerNationId, "대칸국"]]),
      converted,
    );

    expect(mapData.regions.features[0]?.properties.fillColor).toBe("hsl(327 72% 48%)");
    expect(regionFillLayer.paint["fill-opacity"]).toEqual([
      "case",
      ["boolean", ["get", "changed"], false],
      0.78,
      0.66,
    ]);
  });

  test("uses the historical sovereign as a dependency owner", () => {
    // Given
    const collection = convertHistoricalBasemap({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            NAME: "Kenya",
            SUBJECTO: "United Kingdom",
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [34, -5],
                [42, -5],
                [42, 5],
                [34, -5],
              ],
            ],
          },
        },
      ],
    });

    // When
    const feature = collection.features[0];

    // Then
    expect(feature?.properties.provinceId).toBe(historicalProvinceId("Kenya"));
    expect(feature?.properties.ownerNationId).toBe(historicalPolityId("United Kingdom"));
  });
});
