import { afterEach, describe, expect, test } from "bun:test";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  rmdir,
  symlink,
  truncate,
  unlink,
  writeFile,
} from "node:fs/promises";
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
const links: string[] = [];

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

const createDirectoryLink = async (target: string, path: string): Promise<void> => {
  await symlink(target, path, process.platform === "win32" ? "junction" : "dir");
  links.push(path);
};

const removeDirectoryLink = async (path: string): Promise<void> => {
  try {
    if (process.platform === "win32") {
      await rmdir(path);
    } else {
      await unlink(path);
    }
  } catch (error: unknown) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
};

afterEach(async () => {
  await Promise.all(links.splice(0).map(removeDirectoryLink));
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

  test("rejects slot corruption when its SHA-256 checksum no longer matches", async () => {
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

  test("serializes concurrent writes to the same slot in call order", async () => {
    // Given
    const directory = await temporaryDirectory();
    const store = campaignStore();
    const slots = createCampaignSlotStore({ directory, store });

    // When
    const first = slots.save("shared");
    store.replace(jumpCampaignTimeline(store.read(), "week"));
    const second = slots.save("shared");
    const [firstSaved, secondSaved] = await Promise.all([first, second]);

    // Then
    expect(firstSaved.elapsedDays).toBe(0);
    expect(secondSaved.elapsedDays).toBe(7);
    expect(JSON.parse(await readFile(join(directory, "shared.json"), "utf8")).header).toEqual(
      expect.objectContaining({ elapsedDays: 7, stateHash: secondSaved.stateHash }),
    );
  });

  test("does not use a hostile predictable temporary symlink or reparse point", async () => {
    // Given
    const root = await temporaryDirectory();
    const directory = join(root, "slots");
    const outside = join(root, "outside");
    await Promise.all([mkdir(directory), mkdir(outside)]);
    const hostile = join(directory, "guarded.json.tmp");
    await createDirectoryLink(outside, hostile);
    const slots = createCampaignSlotStore({ directory, store: campaignStore() });

    // When
    const saved = await slots.save("guarded");

    // Then
    expect(saved.slot).toBe("guarded");
    expect((await lstat(hostile)).isSymbolicLink()).toBe(true);
    expect(await readdir(outside)).toEqual([]);
    expect(JSON.parse(await readFile(join(directory, "guarded.json"), "utf8")).header).toEqual(
      expect.objectContaining({ stateHash: saved.stateHash }),
    );
  });

  test("rejects a slot symlink or reparse point and leaves no temporary file", async () => {
    // Given
    const root = await temporaryDirectory();
    const directory = join(root, "slots");
    const outside = join(root, "outside");
    await Promise.all([mkdir(directory), mkdir(outside)]);
    const hostile = join(directory, "unsafe.json");
    await createDirectoryLink(outside, hostile);
    const slots = createCampaignSlotStore({ directory, store: campaignStore() });

    // When
    const save = slots.save("unsafe");

    // Then
    await expect(save).rejects.toThrow("SLOT_FILE_UNSAFE");
    await expect(slots.load("unsafe")).rejects.toThrow("SLOT_FILE_UNSAFE");
    expect((await lstat(hostile)).isSymbolicLink()).toBe(true);
    expect((await readdir(directory)).sort()).toEqual(["unsafe.json"]);
  });

  test("isolates a malformed slot while listing valid slots", async () => {
    // Given
    const directory = await temporaryDirectory();
    const slots = createCampaignSlotStore({ directory, store: campaignStore() });
    const valid = await slots.save("valid");
    await writeFile(join(directory, "broken.json"), "{", "utf8");

    // When
    const listed = await slots.list();

    // Then
    expect(listed).toEqual([valid]);
  });

  test("rejects an oversized slot before parsing it", async () => {
    // Given
    const directory = await temporaryDirectory();
    const slots = createCampaignSlotStore({ directory, store: campaignStore() });
    const path = join(directory, "oversized.json");
    await writeFile(path, "", "utf8");
    await truncate(path, 10 * 1024 * 1024 + 1);

    // When
    const load = slots.load("oversized");

    // Then
    await expect(load).rejects.toThrow("SLOT_FILE_TOO_LARGE");
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
