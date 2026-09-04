import {
  historicalBasemapUrl,
  historicalPolityId,
  historicalProvinceId,
  parseHistoricalBasemap,
} from "../../shared/historical-map-contract";
import { parseNationId } from "../../shared/ids";
import { getScenarioAdjacency } from "./adjacency";
import { createPlayableNationStart, listCanonicalCountries } from "./catalog";
import { historicalMajorPolities, historicalSovereignName } from "./historical-scenario-overlays";
import type { ProvinceTerrain, RelationDefinition, ScenarioDefinition } from "./registry";
import type { ScenarioPackageMetadata } from "./types";

export { historicalBasemapSnapshot } from "../../shared/historical-map-contract";

type HistoricalFetch = (url: string) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}>;

export interface HistoricalTerritoryInput {
  readonly name: string | null;
  readonly subject?: string | null | undefined;
}

type HistoricalTerritorySource = string | null | HistoricalTerritoryInput;

const legalActions = Object.freeze([
  "economy.invest",
  "diplomacy.propose_treaty",
  "military.recruit",
]);

const valueHash = (value: string): number => {
  let hash = 0;
  for (const character of value) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  }
  return hash;
};

const infrastructureForYear = (year: number): number => {
  if (year < 0) return 700;
  if (year < 1000) return 1_000;
  if (year < 1800) return 1_500;
  if (year < 1950) return 3_200;
  if (year < 2100) return 5_500;
  return 7_000;
};

const genericPopulationBounds = (year: number): readonly [number, number] => {
  if (year < -500) return [50_000, 2_000_000];
  if (year < 500) return [100_000, 5_000_000];
  if (year < 1500) return [150_000, 8_000_000];
  if (year < 1800) return [200_000, 12_000_000];
  if (year < 1950) return [300_000, 25_000_000];
  if (year < 2100) return [500_000, 50_000_000];
  return [200_000, 15_000_000];
};

const provinceTerrains = Object.freeze([
  "plain",
  "mountain",
  "coast",
  "steppe",
  "forest",
  "desert",
] satisfies readonly ProvinceTerrain[]);

const provinceMetadata = (scenarioId: string, name: string, year: number) => {
  const hash = valueHash(`${scenarioId}:province:${name}`);
  return Object.freeze({
    isPort: hash % 4 === 0,
    terrain: provinceTerrains[hash % provinceTerrains.length] ?? "plain",
    developmentBps: Math.min(10_000, infrastructureForYear(year) + (hash % 1_001)),
  });
};

interface HistoricalTerritory {
  readonly name: string;
  readonly subject: string;
}

const historicalTerritories = (
  sources: readonly HistoricalTerritorySource[],
): readonly HistoricalTerritory[] => {
  const byName = new Map<string, HistoricalTerritory>();
  for (const source of sources) {
    const rawName = typeof source === "string" || source === null ? source : source.name;
    const name = rawName?.trim();
    if (name === undefined || name.length === 0) continue;
    const rawSubject =
      typeof source === "string" || source === null ? undefined : source.subject?.trim();
    byName.set(
      name,
      Object.freeze({
        name,
        subject: rawSubject === undefined || rawSubject.length === 0 ? name : rawSubject,
      }),
    );
  }
  return Object.freeze([...byName.values()]);
};

const historicalRelations = (
  names: readonly string[],
  scenarioId: string,
): ScenarioDefinition["relations"] => {
  const majors = historicalMajorPolities(scenarioId);
  const relations: RelationDefinition[] = names.map((name, index) => {
    const nextName = names[(index + 1) % names.length];
    if (nextName === undefined) throw new RangeError("HISTORICAL_RELATION_TARGET_MISSING");
    return Object.freeze({
      fromNationId: historicalPolityId(name),
      toNationId: historicalPolityId(nextName),
      value: 0,
    });
  });
  for (let left = 0; left < majors.length; left += 1) {
    for (let right = left + 1; right < majors.length; right += 1) {
      const from = majors[left];
      const to = majors[right];
      if (from === undefined || to === undefined) continue;
      const fromName = historicalSovereignName(scenarioId, from.sourceName);
      const toName = historicalSovereignName(scenarioId, to.sourceName);
      if (fromName === toName) continue;
      relations.push(
        Object.freeze({
          fromNationId: historicalPolityId(fromName),
          toNationId: historicalPolityId(toName),
          value: from.bloc === to.bloc ? 450 : -250,
        }),
      );
    }
  }
  return Object.freeze(relations);
};

export const buildHistoricalScenario = (
  metadata: ScenarioPackageMetadata,
  sources: readonly HistoricalTerritorySource[],
): ScenarioDefinition => {
  const territories = historicalTerritories(sources);
  const sovereignNames = Object.freeze([
    ...new Set(territories.map((territory) => territory.subject)),
  ]);
  const available = new Set(sovereignNames);
  const majors = historicalMajorPolities(metadata.id)
    .map((major) =>
      Object.freeze({
        definition: major,
        sovereignName: historicalSovereignName(metadata.id, major.sourceName),
      }),
    )
    .filter((major) => available.has(major.sovereignName));
  const majorNames = new Set(majors.map((major) => major.sovereignName));
  const orderedNames = Object.freeze([
    ...majorNames,
    ...sovereignNames.filter((name) => !majorNames.has(name)),
  ]);
  const majorByName = new Map(
    [...majors].reverse().map((major) => [major.sovereignName, major.definition]),
  );
  const availableHistoricalNationIds = new Set(orderedNames.map(historicalPolityId));
  const historicalNations = orderedNames.map((name, index) => {
    const major = majorByName.get(name);
    const hash = valueHash(`${metadata.id}:${name}`);
    const [minimumPopulation, maximumPopulation] = genericPopulationBounds(metadata.year);
    const population =
      major?.population ?? minimumPopulation + (hash % (maximumPopulation - minimumPopulation + 1));
    const treasuryCredits = major?.treasuryCredits ?? Math.max(80, 240 - index * 5);
    return Object.freeze({
      id: historicalPolityId(name),
      nameKo:
        major?.nameKo ?? (metadata.id === "scn_reconstruction_2281" ? `${name} 재건령` : name),
      capitalLabelKo: major?.capitalLabelKo ?? `${name} 중심지`,
      legalActions,
      treasuryCredits,
      gdpCredits: treasuryCredits * 5,
      taxRateBps: 1_500,
      stabilityBps: major?.stabilityBps ?? 4_500 + (hash % 2_501),
      population,
      infrastructureBps: infrastructureForYear(metadata.year),
      ...(major === undefined
        ? {}
        : {
            governmentKo: major.governmentKo,
            tags: major.tags,
            manpowerPool: major.manpowerPool,
            profile: Object.freeze({
              ...major.profile,
              rivalNationIds: Object.freeze(
                major.profile.rivalNationIds.filter((id) =>
                  availableHistoricalNationIds.has(parseNationId(id)),
                ),
              ),
              allyNationIds: Object.freeze(
                major.profile.allyNationIds.filter((id) =>
                  availableHistoricalNationIds.has(parseNationId(id)),
                ),
              ),
            }),
          }),
    });
  });
  const historicalNationById = new Map(historicalNations.map((nation) => [nation.id, nation]));
  const adjacency = getScenarioAdjacency(metadata.id);
  const historicalProvinceIds = new Set(
    territories.map((territory) => historicalProvinceId(territory.name)),
  );
  const historicalProvinces = territories.map((territory) => {
    const ownerNationId = historicalPolityId(territory.subject);
    const major = majorByName.get(territory.subject);
    return Object.freeze({
      id: historicalProvinceId(territory.name),
      ownerNationId,
      population: historicalNationById.get(ownerNationId)?.population ?? 100_000,
      nameKo: territory.name,
      adjacentProvinceIds: Object.freeze(
        (adjacency[historicalProvinceId(territory.name)] ?? []).filter((id) =>
          historicalProvinceIds.has(id),
        ),
      ),
      isCapital: major?.sourceName === territory.name,
      ...provinceMetadata(metadata.id, territory.name, metadata.year),
    });
  });
  const countries = listCanonicalCountries();
  const fallbackNations = countries.map((country) => {
    const start = createPlayableNationStart(country.alpha2);
    return Object.freeze({
      id: country.id,
      nameKo: country.nameKo,
      capitalLabelKo: start.capitalLabelKo,
      legalActions: start.legalActions,
      treasuryCredits: start.treasuryCredits,
      gdpCredits: start.treasuryCredits * 5,
      taxRateBps: 1_500,
      stabilityBps: start.stabilityBps,
      population: 100_000 + Number(country.numericCode) * 1_000,
      infrastructureBps: infrastructureForYear(metadata.year),
    });
  });
  const fallbackProvinces = countries.map((country) => {
    const id = `prv_${country.alpha3.toLowerCase()}_adm0`;
    return Object.freeze({
      id,
      ownerNationId: parseNationId(country.id),
      population: 100_000 + Number(country.numericCode) * 1_000,
      nameKo: country.nameKo,
      adjacentProvinceIds: Object.freeze([]),
      isCapital: false,
      ...provinceMetadata(metadata.id, id, metadata.year),
    });
  });
  const fallbackRelations = countries.map((country, index) => {
    const nextCountry = countries[(index + 1) % countries.length];
    if (nextCountry === undefined) throw new RangeError("CANONICAL_RELATION_TARGET_MISSING");
    return Object.freeze({
      fromNationId: country.id,
      toNationId: nextCountry.id,
      value: (Number(country.numericCode) % 2_001) - 1_000,
    });
  });
  const nations = Object.freeze([...historicalNations, ...fallbackNations]);
  return Object.freeze({
    id: metadata.id,
    titleKo: metadata.titleKo,
    year: metadata.year,
    quarter: 1,
    playerNationIds: Object.freeze(nations.map((nation) => nation.id)),
    nations,
    provinces: Object.freeze([...historicalProvinces, ...fallbackProvinces]),
    relations: Object.freeze([
      ...historicalRelations(orderedNames, metadata.id),
      ...fallbackRelations,
    ]),
  });
};

export const historicalScenarioSeed = (metadata: ScenarioPackageMetadata): ScenarioDefinition =>
  buildHistoricalScenario(
    metadata,
    historicalMajorPolities(metadata.id).map((major) => ({
      name: major.sourceName,
      subject: historicalSovereignName(metadata.id, major.sourceName),
    })),
  );

export const loadHistoricalScenario = async (
  metadata: ScenarioPackageMetadata,
  fetcher: HistoricalFetch = fetch,
): Promise<ScenarioDefinition> => {
  const response = await fetcher(historicalBasemapUrl(metadata.id));
  if (!response.ok) throw new RangeError(`HISTORICAL_BASEMAP_FETCH_FAILED:${response.status}`);
  const basemap = parseHistoricalBasemap(await response.json());
  return buildHistoricalScenario(
    metadata,
    basemap.features.map((feature) => ({
      name: feature.properties.NAME,
      ...(feature.properties.SUBJECTO === undefined
        ? {}
        : { subject: feature.properties.SUBJECTO }),
    })),
  );
};
