import type { FeatureCollection, Geometry, Point } from "geojson";

import type { Campaign } from "../../state/campaign-store";
import { eastAsiaProvinceById, eastAsiaProvinceCollection } from "./east-asia-map";

export interface OpenHistoriaRegionProperties {
  readonly provinceId: string;
  readonly ownerNationId: string;
  readonly ownerName: string;
  readonly label: string;
  readonly fillColor: string;
  readonly terrain: string;
  readonly population: number;
  readonly changed: boolean;
  readonly sourceNames: readonly string[];
  readonly sourceIso: readonly string[];
  readonly labelAnchor: readonly [number, number];
  readonly bounds: readonly [number, number, number, number];
}

export interface OpenHistoriaLabelProperties {
  readonly provinceId: string;
  readonly label: string;
  readonly ownerNationId: string;
  readonly isCapital: boolean;
}

interface RawRegionProperties {
  readonly provinceId: string;
  readonly sourceNames: readonly string[];
  readonly sourceIso: readonly string[];
  readonly labelAnchor: readonly [number, number];
  readonly bounds: readonly [number, number, number, number];
}

type RawCollection = FeatureCollection<Geometry, RawRegionProperties>;
export type RegionCollection = FeatureCollection<Geometry, OpenHistoriaRegionProperties>;
export type LabelCollection = FeatureCollection<Point, OpenHistoriaLabelProperties>;

const rawCollection = eastAsiaProvinceCollection as unknown as RawCollection;

const knownNationColors: Readonly<Record<string, string>> = {
  nat_kor: "#22c7a9",
  nat_jpn: "#d7a34e",
  nat_qing: "#c46f62",
  nat_rus: "#6d9bc9",
};

const nationColor = (nationId: string): string => {
  const known = knownNationColors[nationId];
  if (known !== undefined) {
    return known;
  }
  let hash = 0;
  for (const character of nationId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `hsl(${hash % 360} 54% 55%)`;
};

export const buildOpenHistoriaMapData = (
  campaign: Campaign,
  nationNameById: ReadonlyMap<string, string>,
): { readonly regions: RegionCollection; readonly labels: LabelCollection } => {
  const provinceById = new Map(campaign.provinces.map((province) => [province.id, province]));
  const changedProvinceIds = new Set(
    campaign.resolutions.at(-1)?.worldImpact.changedProvinceIds ?? [],
  );

  const regions: RegionCollection = {
    type: "FeatureCollection",
    features: rawCollection.features.flatMap((feature) => {
      const province = provinceById.get(feature.properties.provinceId);
      const metadata = eastAsiaProvinceById.get(feature.properties.provinceId);
      if (province === undefined || metadata === undefined) {
        return [];
      }
      return [
        {
          ...feature,
          properties: {
            ...feature.properties,
            ownerNationId: province.ownerNationId,
            ownerName: nationNameById.get(province.ownerNationId) ?? province.ownerNationId,
            label: metadata.labelKo,
            fillColor: nationColor(province.ownerNationId),
            terrain: metadata.terrain,
            population: province.population,
            changed: changedProvinceIds.has(province.id),
          },
        },
      ];
    }),
  };

  const labels: LabelCollection = {
    type: "FeatureCollection",
    features: regions.features.map((feature) => ({
      type: "Feature",
      id: feature.properties.provinceId,
      properties: {
        provinceId: feature.properties.provinceId,
        label: feature.properties.label,
        ownerNationId: feature.properties.ownerNationId,
        isCapital: eastAsiaProvinceById.get(feature.properties.provinceId)?.marker === "capital",
      },
      geometry: {
        type: "Point",
        coordinates: [...feature.properties.labelAnchor],
      },
    })),
  };

  return { regions, labels };
};
