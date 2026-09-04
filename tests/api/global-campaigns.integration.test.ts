import { afterAll, describe, expect, test } from "bun:test";

import { createGameApp } from "../../src/api/app";
import { createCampaignStateFromScenario } from "../../src/application/campaign-state";
import { listScenarios } from "../../src/domain/scenario/registry";

describe("global campaign creation contract", () => {
  let createdCount = 0;
  for (const scenario of listScenarios()) {
    test(`creates every ${scenario.id} country with a complete turn-zero start`, () => {
      for (const playerNationId of scenario.playerNationIds) {
        const campaign = createCampaignStateFromScenario(scenario, playerNationId);
        const player = campaign.nations.find((nation) => nation.id === playerNationId);
        expect(campaign.turn).toBe(0);
        expect(player?.capitalLabelKo.length).toBeGreaterThan(0);
        expect(player?.legalActions.length).toBeGreaterThan(0);
        expect(player?.treasuryCredits).toBeGreaterThan(0);
        expect(
          campaign.provinces.some((province) => province.ownerNationId === playerNationId),
        ).toBe(true);
        expect(
          campaign.relations.some((relation) => relation.fromNationId === playerNationId),
        ).toBe(true);
        createdCount += 1;
      }
    });
  }

  afterAll(() => {
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
        scenarioId: "scn_ea1900",
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
