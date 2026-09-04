import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";
import { createCampaignState, parseCampaignState } from "../../src/application/campaign-state";
import { getScenarioById } from "../../src/domain/scenario/registry";
import { serializeCampaignExport } from "../../src/persistence/export-import";
import { hashCanonical } from "../../src/shared/canonical-json";

const directories: string[] = [];

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "pax-peace-authority-"));
  directories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("war.peace actor authority through the turn API", () => {
  test("rejects a nested actor spoof without changing current state or autosave", async () => {
    const slotDirectory = await temporaryDirectory();
    const scenario = getScenarioById("scn_ea1900");
    const campaign = parseCampaignState({
      ...createCampaignState("scn_ea1900", "nat_kor"),
      wars: [
        {
          id: "war_0_0",
          attackerNationId: "nat_kor",
          targetNationId: "nat_qing",
          status: "active",
          declaredTurn: 0,
        },
      ],
    });
    const app = createGameApp({
      slotDirectory,
      planners: {
        deterministic: async (input) => ({
          schemaVersion: 2,
          requestId: input.requestId,
          playerIntents: [
            {
              type: "war.peace" as const,
              actorNationId: "nat_kor",
              warId: "war_0_0",
              terms: [
                {
                  type: "territory.transfer" as const,
                  actorNationId: "nat_qing",
                  provinceId: "prv_qing_manchuria",
                  fromNationId: "nat_qing",
                  toNationId: "nat_kor",
                  reasonKo: "강화 조약",
                },
              ],
              sourceQuoteKo: input.orderText,
            },
          ],
          npcIntents: [],
          narrative: { ko: "위조된 강화 조건이다." },
          warnings: [],
        }),
      },
      worldEventFactory: () => undefined,
    });
    const imported = await app.request("/api/campaign/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: serializeCampaignExport({
        scenario: { id: scenario.id, revision: 1, canonicalHash: hashCanonical(scenario) },
        state: campaign,
      }),
    });
    expect(imported.status).toBe(200);
    const importedBody = z
      .object({ stateHash: z.string().length(64) })
      .parse(await imported.json());
    const saved = await app.request("/api/campaigns/autosave/save", { method: "POST" });
    expect(saved.status).toBe(201);
    const autosavePath = join(slotDirectory, "autosave.json");
    const autosaveBefore = await readFile(autosavePath, "utf8");

    const response = await app.request("/api/turns/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderText: "청과 강화한다",
        horizon: { mode: "days", days: 7 },
        expectedStateHash: importedBody.stateHash,
        requestId: "req_nested_peace_actor_spoof",
      }),
    });
    const current = await app.request("/api/campaign");

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "provider_plan_invalid", recoverable: false },
    });
    expect(await current.json()).toMatchObject({ stateHash: importedBody.stateHash });
    expect(await readFile(autosavePath, "utf8")).toBe(autosaveBefore);
  });
});
