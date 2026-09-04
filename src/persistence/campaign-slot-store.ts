import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import {
  type CampaignState,
  type LocalCampaignStore,
  parseCampaignState,
} from "../application/campaign-state";
import { getScenarioById } from "../domain/scenario/registry";
import { canonicalStringify, hashCanonical } from "../shared/canonical-json";
import { importCampaignExport, serializeCampaignExport } from "./export-import";

const SLOT_ID = /^[a-z0-9_-]{1,32}$/;
const MAX_SLOT_FILE_BYTES = 10 * 1024 * 1024;
const INVALID_LIST_ENTRY_ERRORS = new Set([
  "SLOT_NOT_FOUND",
  "SLOT_FILE_INVALID",
  "SLOT_FILE_TOO_LARGE",
  "SLOT_FILE_UNSAFE",
]);

const SlotHeaderSchema = z
  .object({
    savedAtTurn: z.number().safe().int().nonnegative(),
    elapsedDays: z.number().safe().int().nonnegative(),
    scenarioId: z.string().regex(/^scn_[a-z0-9_]+$/),
    playerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    stateHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .readonly();

const SlotFileSchema = z
  .object({
    header: SlotHeaderSchema,
    export: z.unknown(),
  })
  .strict()
  .readonly();

const CampaignExportScenarioSchema = z
  .object({
    scenario: z.object({ id: z.string() }).passthrough(),
  })
  .passthrough();

type SlotHeader = z.infer<typeof SlotHeaderSchema>;

export interface SlotSummary extends SlotHeader {
  readonly slot: string;
}

export interface CampaignSlotStore {
  list(): Promise<SlotSummary[]>;
  save(slot: string): Promise<SlotSummary>;
  load(slot: string): Promise<void>;
}

interface CampaignSlotStoreOptions {
  readonly directory: string;
  readonly store: LocalCampaignStore;
}

const parseSlotId = (slot: string): string => {
  if (!SLOT_ID.test(slot)) {
    throw new RangeError("SLOT_ID_INVALID");
  }
  return slot;
};

const scenarioReference = (scenarioId: string) => {
  const scenario = getScenarioById(scenarioId);
  return Object.freeze({
    id: scenario.id,
    revision: 1,
    canonicalHash: hashCanonical(scenario),
  });
};

const isErrorCode = (error: unknown, code: string): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === code;

const errorMessage = (error: unknown): string | undefined =>
  error instanceof Error ? error.message : undefined;

const assertSafeDirectory = async (directory: string): Promise<void> => {
  const stats = await lstat(directory);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new TypeError("SLOT_DIRECTORY_UNSAFE");
  }
};

const assertSafeSlotPath = async (path: string): Promise<void> => {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new TypeError("SLOT_FILE_UNSAFE");
    }
  } catch (error: unknown) {
    if (!isErrorCode(error, "ENOENT")) {
      throw error;
    }
  }
};

const readDirectory = async (directory: string) => {
  try {
    await assertSafeDirectory(directory);
    return await readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    if (isErrorCode(error, "ENOENT")) {
      return [];
    }
    throw error;
  }
};

const readSlotFile = async (path: string): Promise<z.infer<typeof SlotFileSchema>> => {
  let json: string;
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new TypeError("SLOT_FILE_UNSAFE");
    }
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch (error: unknown) {
    if (isErrorCode(error, "ENOENT")) {
      throw new RangeError("SLOT_NOT_FOUND");
    }
    if (isErrorCode(error, "ELOOP")) {
      throw new TypeError("SLOT_FILE_UNSAFE");
    }
    throw error;
  }
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw new TypeError("SLOT_FILE_UNSAFE");
    }
    if (stats.size > MAX_SLOT_FILE_BYTES) {
      throw new RangeError("SLOT_FILE_TOO_LARGE");
    }
    json = await handle.readFile("utf8");
    if (Buffer.byteLength(json, "utf8") > MAX_SLOT_FILE_BYTES) {
      throw new RangeError("SLOT_FILE_TOO_LARGE");
    }
  } finally {
    await handle.close();
  }
  try {
    return SlotFileSchema.parse(JSON.parse(json));
  } catch {
    throw new TypeError("SLOT_FILE_INVALID");
  }
};

const removeTemporaryFile = async (path: string): Promise<void> => {
  try {
    await unlink(path);
  } catch (error: unknown) {
    if (!isErrorCode(error, "ENOENT")) {
      throw error;
    }
  }
};

const replaceSlotFile = async (
  directory: string,
  path: string,
  contents: string,
): Promise<void> => {
  await mkdir(directory, { recursive: true });
  await assertSafeDirectory(directory);
  await assertSafeSlotPath(path);
  const temporaryPath = join(directory, `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await assertSafeDirectory(directory);
    await assertSafeSlotPath(path);
    await rename(temporaryPath, path);
  } finally {
    await removeTemporaryFile(temporaryPath);
  }
};

const headerFor = (campaign: CampaignState, stateHash: string): SlotHeader =>
  SlotHeaderSchema.parse({
    savedAtTurn: campaign.turn,
    elapsedDays: campaign.elapsedDays,
    scenarioId: campaign.scenarioId,
    playerNationId: campaign.playerNationId,
    stateHash,
  });

const assertHeaderMatches = (header: SlotHeader, campaign: CampaignState): void => {
  if (
    header.savedAtTurn !== campaign.turn ||
    header.elapsedDays !== campaign.elapsedDays ||
    header.scenarioId !== campaign.scenarioId ||
    header.playerNationId !== campaign.playerNationId ||
    header.stateHash !== hashCanonical(campaign)
  ) {
    throw new RangeError("SLOT_HEADER_MISMATCH");
  }
};

export const replaceCampaignFromExport = (
  value: unknown,
  store: LocalCampaignStore,
  expectedHeader?: SlotHeader,
): void => {
  const scenarioId = CampaignExportScenarioSchema.parse(value).scenario.id;
  const imported = importCampaignExport({
    json: JSON.stringify(value),
    expectedScenario: scenarioReference(scenarioId),
  });
  const campaign = parseCampaignState(imported.state);
  if (campaign.scenarioId !== imported.scenario.id) {
    throw new RangeError("SCENARIO_STATE_MISMATCH");
  }
  if (expectedHeader !== undefined) {
    assertHeaderMatches(expectedHeader, campaign);
  }
  store.replace(campaign);
};

export const createCampaignSlotStore = ({
  directory,
  store,
}: CampaignSlotStoreOptions): CampaignSlotStore => {
  const writes = new Map<string, Promise<unknown>>();
  const serializeWrite = <T>(slot: string, operation: () => Promise<T>): Promise<T> => {
    const previous = writes.get(slot) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    writes.set(slot, current);
    const finish = () => {
      if (writes.get(slot) === current) {
        writes.delete(slot);
      }
    };
    void current.then(finish, finish);
    return current;
  };

  return {
    async list() {
      const entries = await readDirectory(directory);
      const slots = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name.slice(0, -5))
        .filter((slot) => SLOT_ID.test(slot))
        .sort();
      const summaries = await Promise.all(
        slots.map(async (slot) => {
          try {
            const { header } = await readSlotFile(join(directory, `${slot}.json`));
            return Object.freeze({ slot, ...header });
          } catch (error: unknown) {
            if (INVALID_LIST_ENTRY_ERRORS.has(errorMessage(error) ?? "")) {
              return undefined;
            }
            throw error;
          }
        }),
      );
      return summaries.filter((summary) => summary !== undefined);
    },

    async save(slotValue) {
      const slot = parseSlotId(slotValue);
      const campaign = store.read();
      const header = headerFor(campaign, store.stateHash());
      const serializedExport = serializeCampaignExport({
        scenario: scenarioReference(campaign.scenarioId),
        state: campaign,
      });
      const contents = canonicalStringify({ header, export: JSON.parse(serializedExport) });
      return serializeWrite(slot, async () => {
        await replaceSlotFile(directory, join(directory, `${slot}.json`), contents);
        return Object.freeze({ slot, ...header });
      });
    },

    async load(slotValue) {
      const slot = parseSlotId(slotValue);
      const file = await readSlotFile(join(directory, `${slot}.json`));
      replaceCampaignFromExport(file.export, store, file.header);
    },
  };
};

export const autosaveAfterTurn = (slotStore: CampaignSlotStore): Promise<SlotSummary> =>
  slotStore.save("autosave");
