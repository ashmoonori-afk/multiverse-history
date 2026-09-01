import type { NationId, ScenarioId } from "../../shared/ids";
import { parseScenarioId } from "../../shared/ids";
import {
  createPlayableNationStart,
  listBuiltInScenarioMetadata,
  listCanonicalCountries,
  type ScenarioPackageMetadata,
} from "./catalog";
import { eastAsiaNations, eastAsiaRelations } from "./east-asia-1900/nations";
import { eastAsiaProvinces } from "./east-asia-1900/provinces";

export interface NationDefinition {
  readonly id: NationId;
  readonly nameKo: string;
  readonly capitalLabelKo: string;
  readonly legalActions: readonly string[];
  readonly treasuryCredits: number;
  readonly gdpCredits: number;
  readonly taxRateBps: number;
  readonly stabilityBps: number;
  readonly population: number;
  readonly infrastructureBps: number;
}

export interface ProvinceDefinition {
  readonly id: string;
  readonly ownerNationId: NationId;
  readonly population: number;
}

export interface RelationDefinition {
  readonly fromNationId: NationId;
  readonly toNationId: NationId;
  readonly value: number;
}

export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly titleKo: string;
  readonly year: number;
  readonly quarter: number;
  readonly playerNationIds: readonly NationId[];
  readonly nations: readonly NationDefinition[];
  readonly provinces: readonly ProvinceDefinition[];
  readonly relations: readonly RelationDefinition[];
}

const eastAsia1900: ScenarioDefinition = Object.freeze({
  id: parseScenarioId("scn_ea1900"),
  titleKo: "1900 동아시아",
  year: 1900,
  quarter: 1,
  playerNationIds: Object.freeze(eastAsiaNations.map((nation) => nation.id)),
  nations: eastAsiaNations,
  provinces: eastAsiaProvinces,
  relations: eastAsiaRelations,
});

const neutralScenario = (metadata: ScenarioPackageMetadata): ScenarioDefinition => {
  const countries = listCanonicalCountries();
  const nations = Object.freeze(
    countries.map((country) => {
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
        infrastructureBps: 1_000,
      });
    }),
  );
  const provinces = Object.freeze(
    countries.map((country) =>
      Object.freeze({
        id: `prv_${country.alpha3.toLowerCase()}_adm0`,
        ownerNationId: country.id,
        population: 100_000 + Number(country.numericCode) * 1_000,
      }),
    ),
  );
  const relations = Object.freeze(
    countries.map((country, index) => {
      const nextCountry = countries[(index + 1) % countries.length];
      if (nextCountry === undefined) {
        throw new RangeError("Missing cyclic country relation");
      }
      return Object.freeze({
        fromNationId: country.id,
        toNationId: nextCountry.id,
        value: (Number(country.numericCode) % 2_001) - 1_000,
      });
    }),
  );
  return Object.freeze({
    id: metadata.id,
    titleKo: metadata.titleKo,
    year: metadata.year,
    quarter: 1,
    playerNationIds: Object.freeze(countries.map((country) => country.id)),
    nations,
    provinces,
    relations,
  });
};

const builtInMetadata = listBuiltInScenarioMetadata();
const eastAsiaMetadata = builtInMetadata.find((metadata) => metadata.id === eastAsia1900.id);
if (eastAsiaMetadata === undefined) {
  throw new RangeError("Missing East Asia scenario metadata");
}
const eastAsiaGlobalFallback = neutralScenario(eastAsiaMetadata);
const globallyPlayableEastAsia = Object.freeze({
  ...eastAsia1900,
  playerNationIds: Object.freeze([
    ...new Set([
      ...eastAsiaGlobalFallback.playerNationIds,
      ...eastAsia1900.nations.map((nation) => nation.id),
    ]),
  ]),
  nations: Object.freeze([
    ...eastAsia1900.nations,
    ...eastAsiaGlobalFallback.nations.filter(
      (nation) => !eastAsia1900.nations.some((existing) => existing.id === nation.id),
    ),
  ]),
  provinces: Object.freeze([
    ...eastAsia1900.provinces,
    ...eastAsiaGlobalFallback.provinces.filter(
      (province) =>
        !eastAsia1900.provinces.some(
          (existing) => existing.ownerNationId === province.ownerNationId,
        ),
    ),
  ]),
  relations: Object.freeze([
    ...eastAsia1900.relations,
    ...eastAsiaGlobalFallback.relations.filter(
      (relation) =>
        !eastAsia1900.relations.some((existing) => existing.fromNationId === relation.fromNationId),
    ),
  ]),
});

const scenarios = Object.freeze([
  globallyPlayableEastAsia,
  ...builtInMetadata.filter((metadata) => metadata.id !== eastAsia1900.id).map(neutralScenario),
]);

export const getScenarioById = (scenarioId: string): ScenarioDefinition => {
  const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
  if (scenario === undefined) {
    throw new RangeError(`Unknown scenario: ${scenarioId}`);
  }
  return scenario;
};

export const listScenarios = (): readonly ScenarioDefinition[] => scenarios;
