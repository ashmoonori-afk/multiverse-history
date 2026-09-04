import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
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

const readDirectory = async (directory: string) => {
  try {
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
  try {
    json = await readFile(path, "utf8");
  } catch (error: unknown) {
    if (isErrorCode(error, "ENOENT")) {
      throw new RangeError("SLOT_NOT_FOUND");
    }
    throw error;
  }
  try {
    return SlotFileSchema.parse(JSON.parse(json));
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new TypeError("SLOT_FILE_INVALID");
    }
    throw error;
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
}: CampaignSlotStoreOptions): CampaignSlotStore => ({
  async list() {
    const entries = await readDirectory(directory);
    const slots = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.slice(0, -5))
      .filter((slot) => SLOT_ID.test(slot))
      .sort();
    return Promise.all(
      slots.map(async (slot) => {
        const { header } = await readSlotFile(join(directory, `${slot}.json`));
        return Object.freeze({ slot, ...header });
      }),
    );
  },

  async save(slotValue) {
    const slot = parseSlotId(slotValue);
    const campaign = store.read();
    const header = headerFor(campaign, store.stateHash());
    const serializedExport = serializeCampaignExport({
      scenario: scenarioReference(campaign.scenarioId),
      state: campaign,
    });
    const path = join(directory, `${slot}.json`);
    await mkdir(directory, { recursive: true });
    await writeFile(
      `${path}.tmp`,
      canonicalStringify({ header, export: JSON.parse(serializedExport) }),
      "utf8",
    );
    await rename(`${path}.tmp`, path);
    return Object.freeze({ slot, ...header });
  },

  async load(slotValue) {
    const slot = parseSlotId(slotValue);
    const file = await readSlotFile(join(directory, `${slot}.json`));
    replaceCampaignFromExport(file.export, store, file.header);
  },
});

export const autosaveAfterTurn = (slotStore: CampaignSlotStore): Promise<SlotSummary> =>
  slotStore.save("autosave");
