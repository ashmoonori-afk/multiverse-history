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
  /** True when a former owner still claims this region after a transfer. */
  readonly disputed: boolean;
  readonly claimantNationId: string;
  readonly claimantColor: string;
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

export interface OpenHistoriaConstructionProperties {
  readonly projectId: string;
  readonly provinceId: string;
  readonly ownerNationId: string;
  readonly ownerName: string;
  readonly kind: string;
  readonly investedCredits: number;
  readonly startedTurn: number;
  readonly accentColor: string;
}

export interface OpenHistoriaUnitProperties {
  readonly unitId: string;
  readonly provinceId: string;
  readonly ownerNationId: string;
  readonly ownerName: string;
  readonly manpower: number;
  readonly stackIndex: number;
  readonly strengthLabel: string;
  readonly accentColor: string;
}

interface RawRegionProperties {
  readonly provinceId: string;
  readonly ownerNationId?: string;
  readonly sourceNames: readonly string[];
  readonly sourceIso: readonly string[];
  readonly labelAnchor: readonly [number, number];
  readonly bounds: readonly [number, number, number, number];
}

type RawCollection = FeatureCollection<Geometry, RawRegionProperties>;
export type RegionCollection = FeatureCollection<Geometry, OpenHistoriaRegionProperties>;
export type LabelCollection = FeatureCollection<Point, OpenHistoriaLabelProperties>;
export type ConstructionCollection = FeatureCollection<Point, OpenHistoriaConstructionProperties>;
export type UnitCollection = FeatureCollection<Point, OpenHistoriaUnitProperties>;

/** The slice of persisted campaign state the map presentation lane reads. */
export type MapCampaign = Pick<
  Campaign,
  "provinces" | "resolutions" | "units" | "constructionProjects"
>;

export interface OpenHistoriaMapData {
  readonly regions: RegionCollection;
  readonly labels: LabelCollection;
  readonly constructions: ConstructionCollection;
  readonly units: UnitCollection;
  readonly unitProvinceIds: readonly string[];
}

const rawCollection = eastAsiaProvinceCollection as unknown as RawCollection;

const knownNationColors: Readonly<Record<string, string>> = {
  nat_kor: "#22c7a9",
  nat_jpn: "#d7a34e",
  nat_qing: "#c46f62",
  nat_rus: "#6d9bc9",
  nat_gbr: "#d44c7a",
  nat_fra: "#4c7ad4",
  nat_deu: "#8b8b8b",
  nat_usa: "#4c8bd4",
  nat_nld: "#e8913a",
  nat_tha: "#a67cd4",
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

const anchorByProvinceId: ReadonlyMap<string, readonly [number, number]> = new Map(
  rawCollection.features.map((feature) => [
    feature.properties.provinceId,
    feature.properties.labelAnchor,
  ]),
);

const strengthLabel = (manpower: number): string => `${Math.round(manpower / 1000)}k`;

export const buildOpenHistoriaMapData = (
  campaign: MapCampaign,
  nationNameById: ReadonlyMap<string, string>,
): OpenHistoriaMapData => {
  const provinceById = new Map(campaign.provinces.map((province) => [province.id, province]));
  const provinceByOwnerId = new Map<string, MapCampaign["provinces"][number]>();
  for (const province of campaign.provinces) {
    if (!provinceByOwnerId.has(province.ownerNationId)) {
      provinceByOwnerId.set(province.ownerNationId, province);
    }
  }
  const lastImpact = campaign.resolutions.at(-1)?.worldImpact;
  const changedNationIds = new Set(lastImpact?.changedNationIds ?? []);
  const changedProvinceIds = new Set(lastImpact?.changedProvinceIds ?? []);

  // Latest ownership override per region across the whole campaign history:
  // the former owner keeps a visible claim until it retakes the region.
  const latestClaimByRegionId = new Map<string, string>();
  for (const resolution of campaign.resolutions) {
    for (const override of resolution.worldImpact.regionOwnershipOverrides ?? []) {
      latestClaimByRegionId.set(override.regionId, override.fromNationId);
    }
  }

  const regions: RegionCollection = {
    type: "FeatureCollection",
    features: rawCollection.features.flatMap((feature) => {
      const ownerNationId = feature.properties.ownerNationId;
      const province =
        provinceById.get(feature.properties.provinceId) ??
        (ownerNationId === undefined ? undefined : provinceByOwnerId.get(ownerNationId));
      if (province === undefined) {
        return [];
      }
      const metadata = eastAsiaProvinceById.get(feature.properties.provinceId);
      return [
        {
          ...feature,
          properties: {
            ...feature.properties,
            ownerNationId: province.ownerNationId,
            ownerName: nationNameById.get(province.ownerNationId) ?? province.ownerNationId,
            label:
              metadata?.labelKo ?? feature.properties.sourceNames?.[0] ?? province.ownerNationId,
            fillColor: nationColor(province.ownerNationId),
            terrain: metadata?.terrain ?? "plain",
            population: province.population,
            changed:
              changedProvinceIds.has(province.id) || changedNationIds.has(province.ownerNationId),
            ...((): {
              disputed: boolean;
              claimantNationId: string;
              claimantColor: string;
            } => {
              const claimant = latestClaimByRegionId.get(province.id);
              const disputed = claimant !== undefined && claimant !== province.ownerNationId;
              return {
                disputed,
                claimantNationId: disputed ? claimant : "",
                claimantColor: disputed ? nationColor(claimant) : "",
              };
            })(),
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

  const constructions: ConstructionCollection = {
    type: "FeatureCollection",
    features: campaign.constructionProjects.flatMap((project) => {
      const anchor = anchorByProvinceId.get(project.provinceId);
      if (anchor === undefined) {
        return [];
      }
      return [
        {
          type: "Feature" as const,
          id: project.id,
          properties: {
            projectId: project.id,
            provinceId: project.provinceId,
            ownerNationId: project.ownerNationId,
            ownerName: nationNameById.get(project.ownerNationId) ?? project.ownerNationId,
            kind: project.kind,
            investedCredits: project.investedCredits,
            startedTurn: project.startedTurn,
            accentColor: nationColor(project.ownerNationId),
          },
          geometry: { type: "Point" as const, coordinates: [...anchor] },
        },
      ];
    }),
  };

  const stackByProvinceId = new Map<string, number>();
  const units: UnitCollection = {
    type: "FeatureCollection",
    features: campaign.units.flatMap((unit) => {
      const anchor = anchorByProvinceId.get(unit.provinceId);
      if (anchor === undefined) {
        return [];
      }
      const stackIndex = stackByProvinceId.get(unit.provinceId) ?? 0;
      stackByProvinceId.set(unit.provinceId, stackIndex + 1);
      return [
        {
          type: "Feature" as const,
          id: unit.id,
          properties: {
            unitId: unit.id,
            provinceId: unit.provinceId,
            ownerNationId: unit.ownerNationId,
            ownerName: nationNameById.get(unit.ownerNationId) ?? unit.ownerNationId,
            manpower: unit.manpower,
            stackIndex,
            strengthLabel: strengthLabel(unit.manpower),
            accentColor: nationColor(unit.ownerNationId),
          },
          geometry: { type: "Point" as const, coordinates: [...anchor] },
        },
      ];
    }),
  };

  return {
    regions,
    labels,
    constructions,
    units,
    unitProvinceIds: [...stackByProvinceId.keys()].sort(),
  };
};
