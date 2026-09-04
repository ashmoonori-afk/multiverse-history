import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";

import { createGameApp } from "../../src/api/app";
import { createCampaignStateFromScenario } from "../../src/application/campaign-state";
import { listBuiltInScenarioMetadata } from "../../src/domain/scenario/catalog";
import { getScenarioById } from "../../src/domain/scenario/registry";
import { serializeCampaignExport } from "../../src/persistence/export-import";
import type { ProviderProcessInput } from "../../src/providers/process-runner";
import { parseStrategicPlan } from "../../src/providers/schemas";
import type { StructuredInvocationRunner } from "../../src/providers/structured-invocation";
import { hashCanonical } from "../../src/shared/canonical-json";

const resultPathFrom = (input: ProviderProcessInput): string => {
  const flagIndex = input.args.indexOf("--output-last-message");
  const path = input.args.at(flagIndex + 1);
  if (flagIndex < 0 || path === undefined) throw new RangeError("CODEX_RESULT_PATH_MISSING");
  return path;
};

const createEastAsiaCampaign = async (app: ReturnType<typeof createGameApp>) => {
  const response = await app.request("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenarioId: "scn_ea1900",
      playerNationId: "nat_kor",
      provider: "deterministic",
    }),
  });
  return (await response.json()) as { stateHash: string };
};

describe("API and live-provider resource boundaries", () => {
  test("rejects declared and streamed oversized bodies before JSON materialization", async () => {
    // Given
    const app = createGameApp();
    let materialized = false;
    const declared = new Request("http://localhost/api/campaign/import", {
      method: "POST",
      headers: {
        "content-length": String(10 * 1024 * 1024 + 1),
        "content-type": "application/json",
      },
      body: "{}",
    });
    Object.defineProperty(declared, "json", {
      value: () => {
        materialized = true;
        return Promise.resolve({});
      },
    });

    // When
    const declaredResponse = await app.request(declared);
    const streamedResponse = await app.request("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(1024 * 1024 + 1) }),
    });

    // Then
    expect(declaredResponse.status).toBe(413);
    expect(await declaredResponse.json()).toMatchObject({ error: { code: "import_too_large" } });
    expect(materialized).toBe(false);
    expect(streamedResponse.status).toBe(413);
    expect(await streamedResponse.json()).toMatchObject({
      error: { code: "request_body_too_large" },
    });
  });

  test("carries a selected non-1900 scenario through the real live planner path", async () => {
    // Given
    const metadata = listBuiltInScenarioMetadata().find(
      (candidate) => candidate.id === "scn_world_1939",
    );
    if (metadata === undefined) throw new RangeError("SCENARIO_METADATA_NOT_FOUND");
    const scenario = getScenarioById(metadata.id);
    const playerNationId = scenario.playerNationIds[0];
    const npcNation = scenario.nations.find((nation) => nation.id !== playerNationId);
    if (playerNationId === undefined || npcNation === undefined) {
      throw new RangeError("SCENARIO_NATIONS_MISSING");
    }
    const campaign = createCampaignStateFromScenario(scenario, playerNationId);
    const invocations: ProviderProcessInput[] = [];
    const runner: StructuredInvocationRunner = async (input) => {
      invocations.push(input);
      if (input.requestId === undefined) throw new RangeError("REQUEST_ID_MISSING");
      await writeFile(
        resultPathFrom(input),
        JSON.stringify({
          schemaVersion: 2,
          requestId: input.requestId,
          playerIntents: [],
          npcIntents: [
            {
              type: "nation.adjust",
              nationId: npcNation.id,
              treasuryDelta: null,
              stabilityDelta: 1,
              gdpDelta: null,
              taxRateBps: null,
              reasonKo: "정세 대응",
              sourceQuoteKo: null,
            },
          ],
          narrative: { ko: "각국이 정세 변화에 대응했다." },
          presentation: {
            article: {
              headlineKo: "각국, 정세 대응",
              ledeKo: "각국 정부가 변화한 정세에 대응했다.",
              paragraphsKo: ["정부는 대응책을 발표했다.", "주변국은 후속 조치를 검토했다."],
              quote: null,
            },
            reactions: [
              {
                nationId: npcNation.id,
                stance: "neutral",
                sentimentBps: 0,
                statementKo: "상황을 지켜보겠다.",
              },
            ],
          },
          warnings: [],
        }),
        "utf8",
      );
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const app = createGameApp({ livePlannerRunner: runner, worldEventFactory: () => undefined });
    const imported = await app.request("/api/campaign/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: serializeCampaignExport({
        scenario: {
          id: scenario.id,
          revision: 1,
          canonicalHash: hashCanonical(scenario),
        },
        state: campaign,
      }),
    });
    const { stateHash } = (await imported.json()) as { stateHash: string };

    // When
    const advanced = await app.request("/api/turns/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderText: "국경 방어를 강화한다",
        horizon: { mode: "days", days: 7 },
        provider: "codex",
        expectedStateHash: stateHash,
        requestId: "req_non_1900_live_path",
      }),
    });

    // Then
    expect(imported.status).toBe(200);
    expect(advanced.status, JSON.stringify(await advanced.clone().json())).toBe(200);
    expect(invocations).toHaveLength(1);
    const prompt = invocations[0]?.stdin ?? "";
    for (const value of [
      metadata.id,
      metadata.year,
      metadata.era,
      metadata.titleKo,
      metadata.personaKo,
      metadata.historicalBaselineKo,
    ]) {
      expect(prompt).toContain(String(value));
    }
  });

  test("maps a schema-valid semantic plan failure to a non-retryable 422", async () => {
    // Given
    const app = createGameApp({
      planners: {
        deterministic: async (input) =>
          parseStrategicPlan({
            schemaVersion: 2,
            requestId: input.requestId,
            playerIntents: [],
            npcIntents: [
              {
                type: "nation.adjust",
                nationId: "nat_missing",
                stabilityDelta: 1,
                reasonKo: "존재하지 않는 국가",
              },
            ],
            narrative: { ko: "존재하지 않는 국가를 조정하려 했다." },
            warnings: [],
          }),
      },
      worldEventFactory: () => undefined,
    });
    const created = await createEastAsiaCampaign(app);

    // When
    const response = await app.request("/api/turns/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        horizon: { mode: "days", days: 7 },
        provider: "deterministic",
        expectedStateHash: created.stateHash,
        requestId: "req_semantic_plan_invalid",
      }),
    });
    const after = (await (await app.request("/api/campaign/state-hash")).json()) as {
      stateHash: string;
    };

    // Then
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "provider_plan_invalid", recoverable: false },
    });
    expect(after.stateHash).toBe(created.stateHash);
  });
});
