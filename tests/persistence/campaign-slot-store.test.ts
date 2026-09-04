import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCampaignState,
  jumpCampaignTimeline,
  LocalCampaignStore,
} from "../../src/application/campaign-state";
import {
  autosaveAfterTurn,
  createCampaignSlotStore,
} from "../../src/persistence/campaign-slot-store";

const directories: string[] = [];

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "pax-campaign-slots-"));
  directories.push(directory);
  return directory;
};

const campaignStore = (): LocalCampaignStore => {
  const store = new LocalCampaignStore();
  store.replace(createCampaignState("scn_ea1900", "nat_kor"));
  return store;
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("campaign slot store", () => {
  test("saves and lists a deterministic slot summary", async () => {
    // Given
    const directory = join(await temporaryDirectory(), "created-on-save");
    const store = campaignStore();
    const slots = createCampaignSlotStore({ directory, store });

    // When
    const saved = await slots.save("campaign_1");
    const listed = await slots.list();
    const file = JSON.parse(await readFile(join(directory, "campaign_1.json"), "utf8"));

    // Then
    expect(saved).toEqual({
      slot: "campaign_1",
      savedAtTurn: 0,
      elapsedDays: 0,
      scenarioId: "scn_ea1900",
      playerNationId: "nat_kor",
      stateHash: store.stateHash(),
    });
    expect(listed).toEqual([saved]);
    expect(file.header).toEqual({
      savedAtTurn: 0,
      elapsedDays: 0,
      scenarioId: "scn_ea1900",
      playerNationId: "nat_kor",
      stateHash: store.stateHash(),
    });
    expect(file.export.exportVersion).toBe(1);
  });

  test("loads the saved campaign with its identical state hash", async () => {
    // Given
    const directory = await temporaryDirectory();
    const store = campaignStore();
    const slots = createCampaignSlotStore({ directory, store });
    const saved = await slots.save("restore_me");
    store.replace(jumpCampaignTimeline(store.read(), "week"));
    expect(store.stateHash()).not.toBe(saved.stateHash);

    // When
    await slots.load("restore_me");

    // Then
    expect(store.stateHash()).toBe(saved.stateHash);
  });

  test("rejects a state-hash-tampered slot before replacing the campaign", async () => {
    // Given
    const directory = await temporaryDirectory();
    const store = campaignStore();
    const slots = createCampaignSlotStore({ directory, store });
    const saved = await slots.save("tampered");
    const path = join(directory, "tampered.json");
    const file = JSON.parse(await readFile(path, "utf8"));
    file.export.state.elapsedDays = 91;
    await writeFile(path, JSON.stringify(file), "utf8");

    // When
    const load = slots.load("tampered");

    // Then
    await expect(load).rejects.toThrow("STATE_HASH_MISMATCH");
    expect(store.stateHash()).toBe(saved.stateHash);
  });

  test("ignores a temporary file left by a crash before rename", async () => {
    // Given
    const directory = await temporaryDirectory();
    const store = campaignStore();
    const slots = createCampaignSlotStore({ directory, store });
    await writeFile(join(directory, "interrupted.json.tmp"), "partial", "utf8");

    // When
    const listed = await slots.list();

    // Then
    expect(listed).toEqual([]);
    await expect(access(join(directory, "interrupted.json"))).rejects.toThrow();
  });

  test("autosaves to the reserved autosave slot", async () => {
    // Given
    const directory = await temporaryDirectory();
    const store = campaignStore();
    const slots = createCampaignSlotStore({ directory, store });

    // When
    const saved = await autosaveAfterTurn(slots);

    // Then
    expect(saved.slot).toBe("autosave");
    expect(await slots.list()).toEqual([saved]);
  });
});
