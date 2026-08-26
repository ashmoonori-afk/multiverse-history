import { describe, expect, setDefaultTimeout, test } from "bun:test";

import { createGameApp } from "../../src/api/app";
import { listScenarios } from "../../src/domain/scenario/registry";

setDefaultTimeout(120_000);

describe("global campaign creation contract", () => {
  test("creates every scenario-country pair with a complete turn-zero start", async () => {
    const app = createGameApp();
    let createdCount = 0;

    for (const scenario of listScenarios()) {
      for (const playerNationId of scenario.playerNationIds) {
        const response = await app.request("/api/campaigns", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenarioId: scenario.id, playerNationId }),
        });
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
          campaign: {
            turn: number;
            nations: readonly {
              id: string;
              capitalLabelKo: string;
              legalActions: readonly string[];
              treasuryCredits: number;
            }[];
            provinces: readonly { ownerNationId: string }[];
            relations: readonly { fromNationId: string }[];
          };
        };
        const player = body.campaign.nations.find((nation) => nation.id === playerNationId);
        expect(body.campaign.turn).toBe(0);
        expect(player?.capitalLabelKo.length).toBeGreaterThan(0);
        expect(player?.legalActions.length).toBeGreaterThan(0);
        expect(player?.treasuryCredits).toBeGreaterThan(0);
        expect(
          body.campaign.provinces.some((province) => province.ownerNationId === playerNationId),
        ).toBe(true);
        expect(
          body.campaign.relations.some((relation) => relation.fromNationId === playerNationId),
        ).toBe(true);
        createdCount += 1;
      }
    }

    const expectedCount = listScenarios().reduce(
      (total, scenario) => total + scenario.playerNationIds.length,
      0,
    );
    expect(createdCount).toBe(expectedCount);
  });

  test("persists a custom polity name on a playable country", async () => {
    const app = createGameApp();
    const response = await app.request("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenarioId: "scn_bronze_1200bc",
        playerNationId: "nat_bra",
        customPolityName: "한성 연방",
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      campaign: { nations: readonly { id: string; nameKo: string }[] };
    };
    expect(body.campaign.nations.find((nation) => nation.id === "nat_bra")?.nameKo).toBe(
      "한성 연방",
    );
  });
});
