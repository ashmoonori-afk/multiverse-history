import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import { createGameApp } from "../../src/api/app";

const directories: string[] = [];

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "pax-campaign-api-slots-"));
  directories.push(directory);
  return directory;
};

const createCampaign = async (app: ReturnType<typeof createGameApp>) => {
  const response = await app.request("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId: "scn_ea1900", playerNationId: "nat_kor" }),
  });
  expect(response.status).toBe(201);
  return z.object({ stateHash: z.string() }).parse(await response.json());
};

const SlotFileSchema = z
  .object({
    header: z.object({ stateHash: z.string() }).catchall(z.unknown()),
    export: z.object({ state: z.record(z.string(), z.unknown()) }).catchall(z.unknown()),
  })
  .catchall(z.unknown());

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("campaign slot API", () => {
  test("saves, lists, and loads a campaign slot", async () => {
    // Given
    const slotDirectory = await temporaryDirectory();
    const app = createGameApp({ slotDirectory });
    const created = await createCampaign(app);

    // When
    const saved = await app.request("/api/campaigns/main/save", { method: "POST" });
    const listed = await app.request("/api/campaigns");
    await app.request("/api/timeline/jump", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cadence: "week" }),
    });
    const loaded = await app.request("/api/campaigns/main/load", { method: "POST" });

    // Then
    expect(saved.status).toBe(201);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({ slots: [await saved.json()] });
    expect(loaded.status).toBe(200);
    expect(z.object({ stateHash: z.string() }).parse(await loaded.json()).stateHash).toBe(
      created.stateHash,
    );
  });

  test("maps invalid, missing, and not-started slot operations to client errors", async () => {
    // Given
    const slotDirectory = await temporaryDirectory();
    const app = createGameApp({ slotDirectory });

    // When
    const invalid = await app.request("/api/campaigns/INVALID/save", { method: "POST" });
    const missing = await app.request("/api/campaigns/missing/load", { method: "POST" });
    const notStarted = await app.request("/api/campaigns/empty/save", { method: "POST" });

    // Then
    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(notStarted.status).toBe(409);
  });

  test("rejects a tampered slot with a client error", async () => {
    // Given
    const slotDirectory = await temporaryDirectory();
    const app = createGameApp({ slotDirectory });
    const created = await createCampaign(app);
    await app.request("/api/campaigns/tampered/save", { method: "POST" });
    const path = join(slotDirectory, "tampered.json");
    const file = SlotFileSchema.parse(JSON.parse(await readFile(path, "utf8")));
    const tampered = {
      ...file,
      export: { ...file.export, state: { ...file.export.state, elapsedDays: 365 } },
    };
    await writeFile(path, JSON.stringify(tampered), "utf8");

    // When
    const loaded = await app.request("/api/campaigns/tampered/load", { method: "POST" });
    const current = await app.request("/api/campaign/state-hash");

    // Then
    expect(loaded.status).toBe(400);
    expect(await loaded.json()).toMatchObject({ error: { code: "invalid_request" } });
    expect(await current.json()).toEqual({ stateHash: created.stateHash });
  });
});
