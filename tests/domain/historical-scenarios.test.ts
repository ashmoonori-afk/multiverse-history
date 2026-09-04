import { describe, expect, test } from "bun:test";

import { listBuiltInScenarioMetadata } from "../../src/domain/scenario/catalog";
import {
  buildHistoricalScenario,
  historicalBasemapSnapshot,
} from "../../src/domain/scenario/historical-scenario";
import { historicalPolityId, historicalProvinceId } from "../../src/shared/historical-map-contract";

const fixtureNames = ["Germany", "USSR", "United States", " Germany "] as const;

describe("historical scenario parity", () => {
  test("maps every non-1900 built-in to its own nearest historical snapshot", () => {
    expect(historicalBasemapSnapshot("scn_bronze_1200bc")).toBe("world_bc1000");
    expect(historicalBasemapSnapshot("scn_classical_117")).toBe("world_100");
    expect(historicalBasemapSnapshot("scn_medieval_1200")).toBe("world_1200");
    expect(historicalBasemapSnapshot("scn_steppe_1300")).toBe("world_1300");
    expect(historicalBasemapSnapshot("scn_trade_1650")).toBe("world_1650");
    expect(historicalBasemapSnapshot("scn_world_1939")).toBe("world_1938");
    expect(historicalBasemapSnapshot("scn_coldwar_1962")).toBe("world_1960");
    expect(historicalBasemapSnapshot("scn_modern")).toBe("world_2010");
    expect(historicalBasemapSnapshot("scn_reconstruction_2281")).toBe("world_2010");
  });

  test("creates one playable polity and matching province per named map territory", () => {
    const metadata = listBuiltInScenarioMetadata().find(
      (scenario) => scenario.id === "scn_world_1939",
    );
    if (metadata === undefined) {
      throw new RangeError("Missing 1939 scenario fixture");
    }

    const scenario = buildHistoricalScenario(metadata, fixtureNames);

    expect(scenario.year).toBe(1939);
    expect(scenario.nations.length).toBeGreaterThan(250);
    expect(
      scenario.nations.filter((nation) => String(nation.id).startsWith("nat_hist_")),
    ).toHaveLength(3);
    expect(scenario.provinces.length).toBe(scenario.nations.length);
    expect(scenario.playerNationIds).toEqual(scenario.nations.map((nation) => nation.id));
    expect(scenario.provinces.slice(0, 3).map((province) => province.ownerNationId)).toEqual(
      scenario.nations.slice(0, 3).map((nation) => nation.id),
    );
    expect(scenario.nations[0]?.nameKo).toBe("독일국");
    expect(scenario.nations.some((nation) => nation.nameKo === "소비에트 연방")).toBe(true);
    expect(scenario.relations.length).toBeGreaterThanOrEqual(3);
  });

  test("keeps every built-in year instead of applying 1900 globally", () => {
    const years = new Map(
      listBuiltInScenarioMetadata().map((scenario) => [String(scenario.id), scenario.year]),
    );

    expect(years.get("scn_bronze_1200bc")).toBe(-1200);
    expect(years.get("scn_world_1939")).toBe(1939);
    expect(years.get("scn_reconstruction_2281")).toBe(2281);
  });

  test("uses scenario-specific major populations and distinct lead polities", () => {
    const metadata = new Map(
      listBuiltInScenarioMetadata().map((scenario) => [String(scenario.id), scenario]),
    );
    const modernMetadata = metadata.get("scn_modern");
    const futureMetadata = metadata.get("scn_reconstruction_2281");
    const coldWarMetadata = metadata.get("scn_coldwar_1962");
    const bronzeMetadata = metadata.get("scn_bronze_1200bc");
    const medievalMetadata = metadata.get("scn_medieval_1200");
    const tradeMetadata = metadata.get("scn_trade_1650");
    if (
      modernMetadata === undefined ||
      futureMetadata === undefined ||
      coldWarMetadata === undefined ||
      bronzeMetadata === undefined ||
      medievalMetadata === undefined ||
      tradeMetadata === undefined
    ) {
      throw new RangeError("Missing modern scenario metadata");
    }

    const modern = buildHistoricalScenario(modernMetadata, [
      "United States",
      "China",
      "Korea, Republic of",
    ]);
    const future = buildHistoricalScenario(futureMetadata, [
      "United States",
      "China",
      "Korea, Republic of",
    ]);
    const coldWar = buildHistoricalScenario(coldWarMetadata, ["United States", "USSR"]);
    const bronze = buildHistoricalScenario(bronzeMetadata, ["Assyria"]);
    const medieval = buildHistoricalScenario(medievalMetadata, ["Song Empire"]);
    const trade = buildHistoricalScenario(tradeMetadata, ["Mughal Empire"]);

    expect(modern.nations[0]?.nameKo).toBe("대한민국");
    expect(modern.nations[0]?.population).toBe(52_000_000);
    expect(future.nations[0]?.nameKo).toBe("중화 재건국");
    expect(future.nations[0]?.population).toBe(310_000_000);
    expect(coldWar.nations[0]?.population).toBe(186_000_000);
    expect(bronze.nations[0]?.population).toBe(800_000);
    expect(medieval.nations[0]?.population).toBe(60_000_000);
    expect(trade.nations[0]?.population).toBe(130_000_000);
  });

  test("bounds generated non-major populations by historical era", () => {
    const metadata = new Map(
      listBuiltInScenarioMetadata().map((scenario) => [String(scenario.id), scenario]),
    );
    const bronzeMetadata = metadata.get("scn_bronze_1200bc");
    const tradeMetadata = metadata.get("scn_trade_1650");
    if (bronzeMetadata === undefined || tradeMetadata === undefined) {
      throw new RangeError("Missing population-bound scenario metadata");
    }

    const bronze = buildHistoricalScenario(bronzeMetadata, ["Unlisted Bronze Culture"]);
    const trade = buildHistoricalScenario(tradeMetadata, ["Unlisted Trade Polity"]);

    expect(bronze.nations[0]?.population).toBeLessThanOrEqual(3_000_000);
    expect(trade.nations[0]?.population).toBeLessThanOrEqual(35_000_000);
  });

  test("assigns British dependencies to the United Kingdom polity", () => {
    // Given
    const metadata = listBuiltInScenarioMetadata().find(
      (scenario) => scenario.id === "scn_world_1939",
    );
    if (metadata === undefined) {
      throw new RangeError("Missing 1939 scenario fixture");
    }

    // When
    const scenario = buildHistoricalScenario(metadata, [
      { name: "United Kingdom", subject: "United Kingdom" },
      { name: "Kenya", subject: "United Kingdom" },
    ]);
    const kenyaProvince = scenario.provinces.find(
      (province) => province.id === historicalProvinceId("Kenya"),
    );

    // Then
    expect(kenyaProvince?.ownerNationId).toBe(historicalPolityId("United Kingdom"));
    expect(scenario.nations.filter((nation) => String(nation.id).startsWith("nat_hist_"))).toEqual([
      expect.objectContaining({
        id: historicalPolityId("United Kingdom"),
        nameKo: "대영제국",
      }),
    ]);
  });
});
