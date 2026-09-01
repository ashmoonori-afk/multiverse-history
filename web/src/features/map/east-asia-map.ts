import provinceMetadata from "./east-asia-region-metadata.json";
import dissolvedRegions from "./geometry/east-asia-regions.json";

export type TerrainKind = "mountain" | "forest" | "plain" | "coast";

export interface ProvinceMapFeature {
  readonly id: string;
  readonly labelKo: string;
  readonly terrain: TerrainKind;
  readonly neighbors: readonly string[];
  readonly marker?: "capital" | "city";
  readonly markerLabelKo?: string;
}

export const eastAsiaProvinceMap = provinceMetadata as unknown as readonly ProvinceMapFeature[];

export const eastAsiaProvinceById: ReadonlyMap<string, ProvinceMapFeature> = new Map(
  eastAsiaProvinceMap.map((province) => [province.id, province]),
);

export const capitalProvinceByNationId: Readonly<Record<string, string>> = Object.freeze({
  nat_kor: "prv_kor_hanseong",
  nat_jpn: "prv_jpn_kanto",
  nat_qing: "prv_qing_zhili",
  nat_rus: "prv_rus_primorye",
  nat_gbr: "prv_gbr_hongkong",
  nat_fra: "prv_fra_indochina",
  nat_deu: "prv_deu_qingdao",
  nat_usa: "prv_usa_philippines",
  nat_nld: "prv_nld_east_indies",
  nat_tha: "prv_tha_siam",
});

interface ProvinceGeoFeatureProperties {
  readonly provinceId: string;
  readonly sourceIso: readonly string[];
  readonly sourceNames: readonly string[];
  readonly labelAnchor: readonly [number, number];
  readonly bounds: readonly [number, number, number, number];
}

interface ProvinceGeoFeature {
  readonly type: "Feature";
  readonly id: string;
  readonly properties: ProvinceGeoFeatureProperties;
  readonly geometry:
    | { readonly type: "Polygon"; readonly coordinates: number[][][] }
    | { readonly type: "MultiPolygon"; readonly coordinates: number[][][][] };
}

interface ProvinceGeoCollection {
  readonly type: "FeatureCollection";
  readonly features: readonly ProvinceGeoFeature[];
}

/** Licensed ADM1 geometry dissolved behind stable campaign province IDs. */
export const eastAsiaProvinceCollection = dissolvedRegions as unknown as ProvinceGeoCollection;
