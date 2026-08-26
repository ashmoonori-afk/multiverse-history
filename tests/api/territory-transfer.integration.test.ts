import { describe, expect, test } from "bun:test";

import { createGameApp } from "../../src/api/app";

describe("territory transfer API", () => {
  test("transfers an owned province to a playable target nation", async () => {
    const app = createGameApp();
    const createResponse = await app.request("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: "scn_bronze_1200bc", playerNationId: "nat_bra" }),
    });
    const created = (await createResponse.json()) as {
      campaign: { provinces: readonly { id: string; ownerNationId: string }[] };
    };
    const province = created.campaign.provinces.find(
      (candidate) => candidate.ownerNationId === "nat_bra",
    );
    expect(province).toBeDefined();

    const transferResponse = await app.request("/api/diplomacy/transfers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetNationId: "nat_can",
        provinceId: province?.id,
      }),
    });
    expect(transferResponse.status).toBe(200);
    const transferred = (await transferResponse.json()) as {
      campaign: { provinces: readonly { id: string; ownerNationId: string }[] };
    };
    expect(
      transferred.campaign.provinces.find((candidate) => candidate.id === province?.id)
        ?.ownerNationId,
    ).toBe("nat_can");
  });
});
