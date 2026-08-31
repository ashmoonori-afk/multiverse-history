import { describe, expect, test } from "bun:test";

import { eastAsiaProvinceCollection } from "../../web/src/features/map/east-asia-map";
import { buildOpenHistoriaMapData } from "../../web/src/features/map/open-historia-map-data";
import {
  constructionMarkerLayer,
  OPEN_HISTORIA_CONSTRUCTION_SOURCE,
  OPEN_HISTORIA_UNIT_SOURCE,
  unitCounterLayer,
  unitStrengthLabelLayer,
} from "../../web/src/features/map/open-historia-map-style";

const HANSEONG = "prv_kor_hanseong";
const ZHILI = "prv_qing_zhili";
const PRIMORYE = "prv_rus_primorye";
const UNMAPPED = "prv_atlantis";

const anchorOf = (provinceId: string): readonly [number, number] => {
  const feature = eastAsiaProvinceCollection.features.find(
    (candidate) => candidate.properties.provinceId === provinceId,
  );
  if (feature === undefined) {
    throw new Error(`fixture province ${provinceId} is missing from the geometry collection`);
  }
  return feature.properties.labelAnchor;
};

const nationNames = new Map([
  ["nat_kor", "대한제국"],
  ["nat_qing", "청"],
  ["nat_rus", "러시아 제국"],
]);

const campaignFixture = {
  provinces: [
    { id: HANSEONG, ownerNationId: "nat_kor", population: 1_200_000 },
    { id: ZHILI, ownerNationId: "nat_qing", population: 3_400_000 },
    { id: PRIMORYE, ownerNationId: "nat_rus", population: 210_000 },
  ],
  units: [
    { id: "unt_2", ownerNationId: "nat_kor", provinceId: HANSEONG, manpower: 8_000 },
    { id: "unt_1", ownerNationId: "nat_kor", provinceId: HANSEONG, manpower: 12_000 },
    { id: "unt_3", ownerNationId: "nat_rus", provinceId: PRIMORYE, manpower: 15_000 },
    { id: "unt_ghost", ownerNationId: "nat_kor", provinceId: UNMAPPED, manpower: 4_000 },
  ],
  constructionProjects: [
    {
      id: "cst_1",
      ownerNationId: "nat_kor",
      provinceId: HANSEONG,
      kind: "rail" as const,
      investedCredits: 60,
      startedTurn: 2,
      status: "active" as const,
    },
    {
      id: "cst_2",
      ownerNationId: "nat_qing",
      provinceId: ZHILI,
      kind: "rail" as const,
      investedCredits: 40,
      startedTurn: 3,
      status: "active" as const,
    },
    {
      id: "cst_ghost",
      ownerNationId: "nat_kor",
      provinceId: UNMAPPED,
      kind: "rail" as const,
      investedCredits: 25,
      startedTurn: 1,
      status: "active" as const,
    },
  ],
  resolutions: [],
};

describe("open historia construction projection", () => {
  test("emits one point per mapped project anchored at its province label", () => {
    // Given a campaign carrying two mapped projects and one project on an unmapped province
    // When the map data is built
    const { constructions } = buildOpenHistoriaMapData(campaignFixture, nationNames);

    // Then only the mapped projects project, each at its province label anchor
    expect(constructions.features.map((feature) => feature.properties.projectId)).toEqual([
      "cst_1",
      "cst_2",
    ]);
    expect(constructions.features.map((feature) => feature.geometry.type)).toEqual([
      "Point",
      "Point",
    ]);
    expect(constructions.features[0]?.geometry.coordinates).toEqual([...anchorOf(HANSEONG)]);
    expect(constructions.features[1]?.geometry.coordinates).toEqual([...anchorOf(ZHILI)]);
  });

  test("carries owner, province, kind and investment on every construction feature", () => {
    // Given the same campaign
    // When the map data is built
    const { constructions } = buildOpenHistoriaMapData(campaignFixture, nationNames);

    // Then each feature exposes the persisted project facts the map layer encodes
    expect(constructions.features[0]?.properties).toMatchObject({
      projectId: "cst_1",
      provinceId: HANSEONG,
      ownerNationId: "nat_kor",
      ownerName: "대한제국",
      kind: "rail",
      investedCredits: 60,
      startedTurn: 2,
    });
    expect(constructions.features[1]?.properties.ownerNationId).toBe("nat_qing");
    expect(constructions.features[1]?.properties.investedCredits).toBe(40);
  });
});

describe("open historia unit projection", () => {
  test("emits one point per mapped unit anchored at its province label", () => {
    // Given three mapped units, two of them sharing a province, plus one unmapped unit
    // When the map data is built
    const { units } = buildOpenHistoriaMapData(campaignFixture, nationNames);

    // Then the unmapped unit is dropped and every survivor sits on its province anchor
    expect(units.features.map((feature) => feature.properties.unitId)).toEqual([
      "unt_2",
      "unt_1",
      "unt_3",
    ]);
    expect(units.features[0]?.geometry.coordinates).toEqual([...anchorOf(HANSEONG)]);
    expect(units.features[1]?.geometry.coordinates).toEqual([...anchorOf(HANSEONG)]);
    expect(units.features[2]?.geometry.coordinates).toEqual([...anchorOf(PRIMORYE)]);
  });

  test("carries owner, province, manpower and a stack index per co-located unit", () => {
    // Given two Korean units stacked in Hanseong and one Russian unit in Primorye
    // When the map data is built
    const { units } = buildOpenHistoriaMapData(campaignFixture, nationNames);

    // Then manpower and ownership ride the feature and co-located units get distinct stack indices
    expect(units.features[0]?.properties).toMatchObject({
      unitId: "unt_2",
      provinceId: HANSEONG,
      ownerNationId: "nat_kor",
      manpower: 8_000,
      stackIndex: 0,
    });
    expect(units.features[1]?.properties.stackIndex).toBe(1);
    expect(units.features[2]?.properties).toMatchObject({
      provinceId: PRIMORYE,
      ownerNationId: "nat_rus",
      manpower: 15_000,
      stackIndex: 0,
    });
  });

  test("summarises occupied provinces as a sorted unique id list", () => {
    // Given units in two mapped provinces and one unmapped province
    // When the map data is built
    const { unitProvinceIds } = buildOpenHistoriaMapData(campaignFixture, nationNames);

    // Then only mapped provinces are reported, sorted and deduplicated for the DOM attribute
    expect(unitProvinceIds).toEqual([HANSEONG, PRIMORYE]);
  });

  test("produces byte-identical entity collections on repeated builds", () => {
    // Given the same campaign built twice
    const first = buildOpenHistoriaMapData(campaignFixture, nationNames);
    // When the second build runs
    const second = buildOpenHistoriaMapData(campaignFixture, nationNames);

    // Then the projection is deterministic, so MapLibre diffing stays stable
    expect(first.constructions.features).toHaveLength(2);
    expect(first.units.features).toHaveLength(3);
    expect(JSON.stringify(second.constructions)).toBe(JSON.stringify(first.constructions));
    expect(JSON.stringify(second.units)).toBe(JSON.stringify(first.units));
  });

  test("returns empty entity collections when the campaign persists none", () => {
    // Given a campaign with no units and no construction projects
    const empty = { ...campaignFixture, units: [], constructionProjects: [] };
    // When the map data is built
    const { constructions, units, unitProvinceIds } = buildOpenHistoriaMapData(empty, nationNames);

    // Then the collections stay valid and empty rather than undefined
    expect(constructions.features).toEqual([]);
    expect(units.features).toEqual([]);
    expect(unitProvinceIds).toEqual([]);
  });
});

describe("open historia entity layers", () => {
  test("binds the construction and unit layers to their own visible sources", () => {
    // Given the exported MapLibre style module
    // When the entity source ids and layers are inspected
    // Then each layer reads its dedicated source and ships visible
    expect(OPEN_HISTORIA_CONSTRUCTION_SOURCE).toBe("open-historia-construction");
    expect(OPEN_HISTORIA_UNIT_SOURCE).toBe("open-historia-units");
    expect(constructionMarkerLayer.source).toBe(OPEN_HISTORIA_CONSTRUCTION_SOURCE);
    expect(unitCounterLayer.source).toBe(OPEN_HISTORIA_UNIT_SOURCE);
    expect(unitStrengthLabelLayer.source).toBe(OPEN_HISTORIA_UNIT_SOURCE);
    for (const layer of [constructionMarkerLayer, unitCounterLayer, unitStrengthLabelLayer]) {
      expect(Reflect.get(layer, "layout")?.visibility).not.toBe("none");
      expect(layer.id.startsWith("open-historia-")).toBe(true);
    }
  });
});
