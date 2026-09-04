import {
  type HistoricalBasemap,
  historicalBasemapUrl,
  historicalPolityId,
  historicalProvinceId,
  parseHistoricalBasemap,
} from "./historical-map-contract";
import type { RawCollection } from "./open-historia-map-data";

type HistoricalGeometry = HistoricalBasemap["features"][number]["geometry"];
type PolygonCoordinates = Extract<HistoricalGeometry, { readonly type: "Polygon" }>["coordinates"];

const polygons = (geometry: HistoricalGeometry): readonly PolygonCoordinates[] =>
  geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

const polygonArea = (polygon: PolygonCoordinates): number => {
  const outerRing = polygon[0];
  if (outerRing === undefined) return 0;
  let doubledArea = 0;
  for (let index = 0; index < outerRing.length; index += 1) {
    const point = outerRing[index];
    const nextPoint = outerRing[(index + 1) % outerRing.length];
    if (point !== undefined && nextPoint !== undefined) {
      doubledArea += point[0] * nextPoint[1] - nextPoint[0] * point[1];
    }
  }
  return Math.abs(doubledArea) / 2;
};

const coordinateBounds = (
  points: readonly (readonly [number, number])[],
): readonly [number, number, number, number] => {
  const longitudes = points.map((point) => point[0]);
  const latitudes = points.map((point) => point[1]);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
};

export const convertHistoricalBasemap = (basemap: HistoricalBasemap): RawCollection => {
  const polygonsByName = new Map<string, PolygonCoordinates[]>();
  const ownerByName = new Map<string, string>();
  for (const feature of basemap.features) {
    const sourceName = feature.properties.NAME?.trim();
    if (sourceName === undefined || sourceName.length === 0) continue;
    const subjectName = feature.properties.SUBJECTO?.trim();
    const existing = polygonsByName.get(sourceName) ?? [];
    existing.push(...polygons(feature.geometry));
    polygonsByName.set(sourceName, existing);
    ownerByName.set(
      sourceName,
      subjectName === undefined || subjectName.length === 0 ? sourceName : subjectName,
    );
  }
  return {
    type: "FeatureCollection",
    features: [...polygonsByName].map(([sourceName, groupedPolygons]) => {
      const points = groupedPolygons.flat(2);
      const [minLongitude, minLatitude, maxLongitude, maxLatitude] = coordinateBounds(points);
      const largestPolygon = groupedPolygons.reduce((largest, candidate) =>
        polygonArea(candidate) > polygonArea(largest) ? candidate : largest,
      );
      const [labelMinLongitude, labelMinLatitude, labelMaxLongitude, labelMaxLatitude] =
        coordinateBounds(largestPolygon.flat(1));
      const provinceId = historicalProvinceId(sourceName);
      return {
        type: "Feature" as const,
        id: provinceId,
        properties: {
          provinceId,
          ownerNationId: historicalPolityId(ownerByName.get(sourceName) ?? sourceName),
          sourceNames: [sourceName],
          sourceIso: [],
          labelAnchor: [
            (labelMinLongitude + labelMaxLongitude) / 2,
            (labelMinLatitude + labelMaxLatitude) / 2,
          ] as const,
          bounds: [minLongitude, minLatitude, maxLongitude, maxLatitude] as const,
        },
        geometry:
          groupedPolygons.length === 1
            ? { type: "Polygon" as const, coordinates: groupedPolygons[0] ?? [] }
            : { type: "MultiPolygon" as const, coordinates: groupedPolygons },
      };
    }),
  };
};

export const loadHistoricalMapCollection = async (
  scenarioId: string,
  fetcher: typeof fetch = fetch,
): Promise<RawCollection> => {
  const response = await fetcher(historicalBasemapUrl(scenarioId));
  if (!response.ok) throw new RangeError(`HISTORICAL_BASEMAP_FETCH_FAILED:${response.status}`);
  return convertHistoricalBasemap(parseHistoricalBasemap(await response.json()));
};
