import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { openAdvisor, openHudPanel, startKoreanCampaign } from "./helpers/open-historia";

const CONSTRUCTION_SOURCE = "open-historia-construction";
const UNIT_SOURCE = "open-historia-units";
const HOME_PROVINCE = "prv_kor_hanseong";
const FRONT_PROVINCE = "prv_rus_primorye";

interface ProbedFeature {
  readonly properties: Record<string, unknown>;
  readonly coordinates: readonly number[];
}

/**
 * Reads the live MapLibre GeoJSON source rather than the React props that fed it,
 * so the assertion fails if the source is never registered or never updated.
 */
const readMapSource = async (page: Page, sourceId: string): Promise<readonly ProbedFeature[]> =>
  page.evaluate(async (id: string) => {
    const map = Reflect.get(window, "__openHistoriaMap");
    if (map === undefined || map === null) {
      throw new Error("MapLibre dev handle is missing; the map never reported load");
    }
    const source = map.getSource(id);
    if (source === undefined || source === null) {
      throw new Error(`MapLibre source "${id}" is not registered on the live map`);
    }
    const data = await source.getData();
    return data.features.map((feature: { properties: unknown; geometry: unknown }) => ({
      properties: feature.properties,
      coordinates: Reflect.get(feature.geometry ?? {}, "coordinates"),
    }));
  }, sourceId);

const recruitHomeUnit = async (page: Page): Promise<void> => {
  await openAdvisor(page);
  const advisor = page.getByRole("complementary", { name: "전략 자문" });
  const militaryTab = advisor.getByRole("button", { name: "군사", exact: true });
  await militaryTab.click();
  await expect(militaryTab).toHaveAttribute("aria-current", "page");
  await page.getByTestId("recruit-province").selectOption(HOME_PROVINCE);
  await page.getByTestId("recruit-unit").click();
};

test.describe("Open Historia map consequences", () => {
  test("projects persisted units and construction onto live MapLibre sources", async ({
    page,
  }, testInfo) => {
    testInfo.skip(testInfo.project.name !== "desktop", "single desktop evidence capture");
    await startKoreanCampaign(page);
    const world = page.getByTestId("open-historia-world");

    // Given a fresh campaign that persists no units and no construction projects
    await expect(world).toHaveAttribute("data-unit-count", "0");
    await expect(world).toHaveAttribute("data-construction-count", "0");
    await expect(world).toHaveAttribute("data-unit-provinces", "");
    expect(await readMapSource(page, UNIT_SOURCE)).toEqual([]);
    expect(await readMapSource(page, CONSTRUCTION_SOURCE)).toEqual([]);

    // When the player recruits a unit in the capital province
    await recruitHomeUnit(page);

    // Then the map root and the live unit source both carry the persisted unit
    await expect(world).toHaveAttribute("data-unit-count", "1");
    await expect(world).toHaveAttribute("data-unit-provinces", HOME_PROVINCE);
    await expect.poll(async () => (await readMapSource(page, UNIT_SOURCE)).length).toBe(1);
    const recruited = await readMapSource(page, UNIT_SOURCE);
    expect(recruited[0]?.properties["provinceId"]).toBe(HOME_PROVINCE);
    expect(recruited[0]?.properties["ownerNationId"]).toBe("nat_kor");
    expect(recruited[0]?.properties["manpower"]).toEqual(expect.any(Number));
    expect(recruited[0]?.properties["stackIndex"]).toBe(0);
    expect(recruited[0]?.coordinates).toHaveLength(2);

    // When that unit moves to the Russian front
    await page.getByTestId("unit-select").selectOption("latest");
    await page.getByTestId("move-province").selectOption(FRONT_PROVINCE);
    await page.getByTestId("move-unit").click();

    // Then the projection follows the persisted province, not the recruit province
    await expect(world).toHaveAttribute("data-unit-provinces", FRONT_PROVINCE);
    await expect
      .poll(async () => (await readMapSource(page, UNIT_SOURCE))[0]?.properties["provinceId"])
      .toBe(FRONT_PROVINCE);
    const moved = await readMapSource(page, UNIT_SOURCE);
    expect(moved).toHaveLength(1);
    expect(moved[0]?.coordinates).not.toEqual(recruited[0]?.coordinates);
    // Evidence: an unobstructed map showing the moved unit counter on its new province.
    await page.getByTestId("close-advisor").click();
    await expect(page.getByRole("complementary", { name: "전략 자문" })).toBeHidden();
    // Frame the moved unit, then prove the counter actually paints rather than
    // merely sitting in the source data.
    const unitCenter = moved[0]?.coordinates ?? [];
    await page.evaluate((center: readonly number[]) => {
      Reflect.get(window, "__openHistoriaMap").jumpTo({ center, zoom: 5 });
    }, unitCenter);
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            Reflect.get(window, "__openHistoriaMap").queryRenderedFeatures({
              layers: ["open-historia-unit-counter"],
            }).length,
        ),
      )
      .toBeGreaterThan(0);
    // Settle on the map's own idle event so the capture is never mid-tile-load.
    await page.evaluate(
      async () =>
        new Promise<void>((resolve) => {
          const map = Reflect.get(window, "__openHistoriaMap");
          if (map.loaded() && map.areTilesLoaded()) {
            resolve();
            return;
          }
          const settle = (): void => {
            map.off("idle", settle);
            resolve();
          };
          map.on("idle", settle);
        }),
    );
    await page.screenshot({
      path: ".omo/evidence/simulation-six/map-consequences-desktop.png",
      fullPage: false,
    });

    // When a resolved turn commits rail investment into persisted construction projects
    await openHudPanel(page, "oh-actions", "행동과 명령");
    await page.getByTestId("order-input").fill("한성에 철도망을 확장한다");
    await page.getByTestId("advance-turn").click();
    await expect(page.getByTestId("campaign-result-panel")).toBeVisible();

    // Then the construction source carries one point per persisted project
    await expect(world).not.toHaveAttribute("data-construction-count", "0");
    const built = await readMapSource(page, CONSTRUCTION_SOURCE);
    expect(built.length).toBeGreaterThan(0);
    expect(built[0]?.properties["kind"]).toBe("rail");
    expect(built[0]?.properties["ownerNationId"]).toBe("nat_kor");
    expect(built[0]?.properties["investedCredits"]).toEqual(expect.any(Number));
    expect(built[0]?.coordinates).toHaveLength(2);
    await expect(world).toHaveAttribute("data-construction-count", String(built.length));
    const constructionCenter = built[0]?.coordinates ?? [];
    await page.evaluate(
      ({ unit, construction }) => {
        const bounds = [
          [
            Math.min(unit[0] ?? 0, construction[0] ?? 0),
            Math.min(unit[1] ?? 0, construction[1] ?? 0),
          ],
          [
            Math.max(unit[0] ?? 0, construction[0] ?? 0),
            Math.max(unit[1] ?? 0, construction[1] ?? 0),
          ],
        ];
        Reflect.get(window, "__openHistoriaMap").fitBounds(bounds, {
          padding: 140,
          duration: 0,
          maxZoom: 5,
        });
      },
      { unit: unitCenter, construction: constructionCenter },
    );
    await page.evaluate(
      async () =>
        new Promise<void>((resolve) => {
          const map = Reflect.get(window, "__openHistoriaMap");
          if (map.loaded() && map.areTilesLoaded()) {
            resolve();
            return;
          }
          map.once("idle", resolve);
        }),
    );
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            Reflect.get(window, "__openHistoriaMap").queryRenderedFeatures({
              layers: ["open-historia-unit-counter", "open-historia-construction-marker"],
            }).length,
        ),
      )
      .toBeGreaterThanOrEqual(2);
    await page.screenshot({
      path: ".omo/evidence/simulation-six/map-consequences-desktop.png",
      fullPage: false,
    });
  });
});
