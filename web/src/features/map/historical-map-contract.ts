import { z } from "zod";

import { NationIdSchema } from "../../state/campaign-id-schemas";

const snapshotByScenarioId = Object.freeze({
  scn_bronze_1200bc: "world_bc1000",
  scn_classical_117: "world_100",
  scn_medieval_1200: "world_1200",
  scn_steppe_1300: "world_1300",
  scn_trade_1650: "world_1650",
  scn_ea1900: "world_1900",
  scn_world_1939: "world_1938",
  scn_coldwar_1962: "world_1960",
  scn_modern: "world_2010",
  scn_reconstruction_2281: "world_2010",
} as const);

const PositionSchema = z.tuple([z.number().finite(), z.number().finite()]);
const RingSchema = z.array(PositionSchema).min(4);
const PolygonCoordinatesSchema = z.array(RingSchema).min(1);
const HistoricalGeometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: PolygonCoordinatesSchema }).strict(),
  z
    .object({
      type: z.literal("MultiPolygon"),
      coordinates: z.array(PolygonCoordinatesSchema).min(1),
    })
    .strict(),
]);
const HistoricalBasemapSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(
      z
        .object({
          type: z.literal("Feature"),
          properties: z
            .object({
              NAME: z.string().nullable(),
              SUBJECTO: z.string().nullable().optional(),
            })
            .passthrough(),
          geometry: HistoricalGeometrySchema,
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type HistoricalBasemap = z.infer<typeof HistoricalBasemapSchema>;

export const parseHistoricalBasemap = (value: unknown): HistoricalBasemap =>
  HistoricalBasemapSchema.parse(value);

export const historicalBasemapSnapshot = (scenarioId: string): string => {
  const snapshot = snapshotByScenarioId[scenarioId as keyof typeof snapshotByScenarioId];
  if (snapshot === undefined) {
    throw new RangeError("HISTORICAL_BASEMAP_SCENARIO_UNKNOWN");
  }
  return snapshot;
};

export const historicalBasemapUrl = (scenarioId: string): string =>
  `https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/${historicalBasemapSnapshot(scenarioId)}.geojson`;

const stableHash = (value: string): string => {
  let hash = 2_166_136_261;
  for (const character of value.normalize("NFKC")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
};

const sourceSlug = (sourceName: string): string => {
  const slug = sourceName
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replaceAll("&", " and ")
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .slice(0, 44);
  return slug.length > 0 ? slug : "unnamed";
};

export const historicalPolityId = (sourceName: string): string =>
  NationIdSchema.parse(`nat_hist_${sourceSlug(sourceName)}_${stableHash(sourceName)}`);

export const historicalProvinceId = (sourceName: string): string =>
  `prv_hist_${sourceSlug(sourceName)}_${stableHash(sourceName)}`;
