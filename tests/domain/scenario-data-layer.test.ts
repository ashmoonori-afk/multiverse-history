import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

import { createCampaignStateFromScenario } from "../../src/application/campaign-state";
import { listBuiltInScenarioMetadata } from "../../src/domain/scenario/catalog";
import { eastAsiaNations } from "../../src/domain/scenario/east-asia-1900/nations";
import { eastAsiaProvinces } from "../../src/domain/scenario/east-asia-1900/provinces";
import { loadHistoricalScenario } from "../../src/domain/scenario/historical-scenario";
import { historicalMajorPolities } from "../../src/domain/scenario/historical-scenario-overlays";
import type { ScenarioDefinition } from "../../src/domain/scenario/registry";
import { getScenarioById, listScenarios } from "../../src/domain/scenario/registry";
import { parseNationId } from "../../src/shared/ids";

const AdjacencySchema = z.record(z.string(), z.array(z.string()));
const RegionMetadataSchema = z.array(
  z.object({ id: z.string(), neighbors: z.array(z.string()) }).passthrough(),
);
const historicalMetadata = listBuiltInScenarioMetadata().filter(
  (scenario) => scenario.id !== "scn_ea1900",
);

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));

const undirectedEdges = (adjacency: Readonly<Record<string, readonly string[]>>): Set<string> =>
  new Set(
    Object.entries(adjacency).flatMap(([provinceId, neighbors]) =>
      neighbors.map((neighborId) => [provinceId, neighborId].sort().join("|")),
    ),
  );

const expectSymmetric = (adjacency: Readonly<Record<string, readonly string[]>>): void => {
  for (const [provinceId, neighbors] of Object.entries(adjacency)) {
    for (const neighborId of neighbors) expect(adjacency[neighborId]).toContain(provinceId);
  }
};

const expectValidScenarioAdjacency = (scenario: ScenarioDefinition): void => {
  const provinceIds = new Set(scenario.provinces.map((province) => province.id));
  for (const province of scenario.provinces) {
    for (const neighborId of province.adjacentProvinceIds ?? []) {
      expect(provinceIds.has(neighborId)).toBe(true);
      expect(
        scenario.provinces.find((candidate) => candidate.id === neighborId)?.adjacentProvinceIds,
      ).toContain(province.id);
    }
  }
};

const findPython = (): readonly string[] => {
  const candidates =
    process.platform === "win32"
      ? [
          [join(process.env["LOCALAPPDATA"] ?? "", "Programs/Python/Python313/python.exe")],
          ["py", "-3"],
          ["python"],
        ]
      : [["python3"], ["python"]];
  const command = candidates.find(([executable, ...arguments_]) => {
    if (
      executable === undefined ||
      (executable !== "py" && executable !== "python" && !existsSync(executable))
    ) {
      return false;
    }
    return (
      spawnSync(executable, [...arguments_, "-c", "import shapely"], { encoding: "utf8" })
        .status === 0
    );
  });
  if (command === undefined) throw new RangeError("PYTHON_WITH_SHAPELY_NOT_FOUND");
  return command;
};

describe("scenario data layer", () => {
  test("keeps the server 1900 adjacency identical to the client contract and symmetric", () => {
    // Given
    const regions = RegionMetadataSchema.parse(
      readJson("web/src/features/map/east-asia-region-metadata.json"),
    );

    // When
    const server = AdjacencySchema.parse(readJson("src/domain/scenario/adjacency/scn_ea1900.json"));
    const client = Object.fromEntries(
      regions.map((region) => [region.id, [...region.neighbors].sort()]),
    );

    // Then
    expect(new Set(Object.keys(server))).toEqual(new Set(Object.keys(client)));
    expect(undirectedEdges(server)).toEqual(undirectedEdges(client));
    expectSymmetric(server);
  });

  test("exposes only symmetric, valid province adjacency in every scenario", () => {
    // Given
    const scenarios = listScenarios();

    // When
    const adjacencyFiles = new Map(
      listBuiltInScenarioMetadata().map((metadata) => [
        metadata.id,
        AdjacencySchema.parse(readJson(`src/domain/scenario/adjacency/${metadata.id}.json`)),
      ]),
    );

    // Then
    expect(adjacencyFiles.size).toBe(scenarios.length);
    for (const scenario of scenarios) {
      const storedAdjacency = adjacencyFiles.get(scenario.id);
      expect(storedAdjacency).toBeDefined();
      expectSymmetric(storedAdjacency ?? {});
      expectValidScenarioAdjacency(scenario);
    }
  });

  test("stores at least one province in every historical adjacency graph", () => {
    // Given
    const scenarios = historicalMetadata;

    // When
    const emptyScenarioIds = scenarios
      .filter(
        (metadata) =>
          Object.keys(
            AdjacencySchema.parse(readJson(`src/domain/scenario/adjacency/${metadata.id}.json`)),
          ).length === 0,
      )
      .map((metadata) => metadata.id);

    // Then
    expect(emptyScenarioIds).toEqual([]);
  });

  test("stores an exact adjacency graph for every loaded historical scenario", async () => {
    // Given
    const metadata = historicalMetadata;

    // When
    const scenarios = await Promise.all(
      metadata.map(async (scenarioMetadata) => ({
        scenario: await loadHistoricalScenario(scenarioMetadata),
        stored: AdjacencySchema.parse(
          readJson(`src/domain/scenario/adjacency/${scenarioMetadata.id}.json`),
        ),
      })),
    );

    // Then
    for (const { scenario, stored } of scenarios) {
      expect(new Set(Object.keys(stored))).toEqual(
        new Set(scenario.provinces.map((province) => province.id)),
      );
      expect(undirectedEdges(stored).size).toBeGreaterThan(0);
    }
  }, 60_000);

  test("loads every repository geometry without crashing on malformed coordinate nesting", () => {
    // Given
    const [python, ...pythonArguments] = findPython();
    if (python === undefined) throw new RangeError("PYTHON_WITH_SHAPELY_NOT_FOUND");

    // When
    const result = spawnSync(
      python,
      [
        ...pythonArguments,
        "-c",
        'import runpy; runpy.run_path("scripts/build-adjacency.py", run_name="adjacency_test")["local_east_asia_geometries"]()',
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    // Then
    expect(result.stderr).toContain("warning: skipped invalid local geometry");
    expect(result.status).toBe(0);
  }, 30_000);

  test("gives every explicit 1900 nation one capital and a strategic profile", () => {
    // Given
    const allowedTags = new Set([
      "great_power",
      "colonial",
      "declining",
      "reformist",
      "isolationist",
      "expansionist",
    ]);

    // When
    const capitalsByNation = new Map(
      eastAsiaNations.map((nation) => [
        nation.id,
        eastAsiaProvinces.filter(
          (province) => province.ownerNationId === nation.id && province.isCapital,
        ),
      ]),
    );

    // Then
    for (const nation of eastAsiaNations) {
      expect(capitalsByNation.get(nation.id)).toHaveLength(1);
      expect(nation.governmentKo).toBeString();
      expect(nation.manpowerPool).toBeGreaterThan(0);
      expect(nation.profile?.goalsKo.length).toBeGreaterThanOrEqual(2);
      expect(nation.profile?.goalsKo.length).toBeLessThanOrEqual(4);
      expect(nation.profile?.personalityKo).toBeString();
      expect(nation.tags?.every((tag) => allowedTags.has(tag))).toBe(true);
    }
  });

  test("gives every historical major polity authored starting data and a profile", () => {
    // Given
    const historicalScenarioIds = listBuiltInScenarioMetadata()
      .map((scenario) => scenario.id)
      .filter((scenarioId) => scenarioId !== "scn_ea1900");

    // When
    const overlays = historicalScenarioIds.map((scenarioId) => ({
      scenarioId,
      polities: historicalMajorPolities(scenarioId),
    }));

    // Then
    for (const overlay of overlays) {
      expect(overlay.polities.length).toBeGreaterThanOrEqual(6);
      expect(overlay.polities.length).toBeLessThanOrEqual(10);
      for (const polity of overlay.polities) {
        expect(polity.treasuryCredits).toBeGreaterThan(0);
        expect(polity.stabilityBps).toBeGreaterThanOrEqual(0);
        expect(polity.stabilityBps).toBeLessThanOrEqual(10_000);
        expect(polity.governmentKo).toBeString();
        expect(polity.tags.length).toBeGreaterThan(0);
        expect(polity.profile.goalsKo.length).toBeGreaterThanOrEqual(2);
        expect(polity.profile.personalityKo).toBeString();
      }
    }
    const world1939 = getScenarioById("scn_world_1939");
    const germanyOverlay = historicalMajorPolities("scn_world_1939")[0];
    const germany = world1939.nations.find((nation) => nation.nameKo === "독일국");
    expect(germany).toEqual(
      expect.objectContaining({
        treasuryCredits: germanyOverlay?.treasuryCredits,
        stabilityBps: germanyOverlay?.stabilityBps,
        governmentKo: germanyOverlay?.governmentKo,
        tags: germanyOverlay?.tags,
        profile: germanyOverlay?.profile,
      }),
    );
  });

  test("exposes authored 1900 fields and passes them into campaign state", () => {
    // Given
    const scenario = getScenarioById("scn_ea1900");

    // When
    const campaign = createCampaignStateFromScenario(scenario, "nat_kor");
    const nation = campaign.nations.find((candidate) => candidate.id === "nat_kor");
    const province = campaign.provinces.find((candidate) => candidate.id === "prv_kor_hanseong");

    // Then
    expect(nation).toEqual(
      expect.objectContaining({
        governmentKo: "전제군주제",
        manpowerPool: expect.any(Number),
        profile: expect.any(Object),
        tags: expect.any(Array),
      }),
    );
    expect(province).toEqual(
      expect.objectContaining({
        nameKo: "한성",
        adjacentProvinceIds: expect.any(Array),
        isCapital: true,
        isPort: true,
        terrain: "plain",
        developmentBps: expect.any(Number),
      }),
    );
    expect(scenario.initialUnits).toHaveLength(19);
    const unitCounts = Object.fromEntries(
      [...(scenario.initialUnits ?? [])]
        .map((unit) => unit.nationId)
        .reduce<Map<string, number>>(
          (counts, nationId) => counts.set(nationId, (counts.get(nationId) ?? 0) + 1),
          new Map(),
        ),
    );
    expect(unitCounts).toEqual({
      nat_jpn: 6,
      nat_rus: 3,
      nat_qing: 4,
      nat_kor: 2,
      nat_gbr: 1,
      nat_fra: 1,
      nat_deu: 1,
      nat_usa: 1,
    });
  });

  test("places every authored 1900 unit into campaign state", () => {
    // Given
    const scenario = getScenarioById("scn_ea1900");

    // When
    const campaign = createCampaignStateFromScenario(scenario, "nat_kor");

    // Then
    expect(campaign.units).toHaveLength(19);
    expect(campaign.units).toEqual(
      (scenario.initialUnits ?? []).map(({ nationId, ...unit }) => ({
        ...unit,
        ownerNationId: nationId,
      })),
    );
    expect(Object.isFrozen(campaign.units)).toBe(true);
    expect(campaign.units.every((unit) => Object.isFrozen(unit))).toBe(true);
  });

  test("starts without units when the scenario has no initial units", () => {
    // Given
    const scenario = getScenarioById("scn_world_1939");
    const playerNationId = scenario.playerNationIds[0];
    if (playerNationId === undefined) throw new RangeError("SCENARIO_HAS_NO_PLAYABLE_NATION");

    // When
    const campaign = createCampaignStateFromScenario(scenario, playerNationId);

    // Then
    expect(campaign.units).toEqual([]);
  });

  test("rejects initial units with invalid nation or province ownership references", () => {
    // Given
    const scenario = getScenarioById("scn_ea1900");
    const invalidUnits = [
      {
        id: "unt_invalid_nation",
        nationId: parseNationId("nat_missing"),
        provinceId: "prv_kor_hanseong",
        manpower: 1,
      },
      {
        id: "unt_invalid_province",
        nationId: parseNationId("nat_kor"),
        provinceId: "prv_missing",
        manpower: 1,
      },
      {
        id: "unt_invalid_owner",
        nationId: parseNationId("nat_kor"),
        provinceId: "prv_jpn_hokkaido",
        manpower: 1,
      },
    ];

    // When / Then
    for (const unit of invalidUnits) {
      expect(() =>
        createCampaignStateFromScenario({ ...scenario, initialUnits: [unit] }, "nat_kor"),
      ).toThrow("SCENARIO_INITIAL_UNIT_INVALID");
    }
  });
});
