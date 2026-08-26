import { z } from "zod";

import { canonicalStringify, hashCanonical } from "../shared/canonical-json";

export interface ScenarioReference {
  readonly id: string;
  readonly revision: number;
  readonly canonicalHash: string;
}

export interface CampaignExport {
  readonly exportVersion: 1;
  readonly exportedStateHash: string;
  readonly scenario: ScenarioReference;
  readonly state: unknown;
}

export interface ExportCampaignInput {
  readonly scenario: ScenarioReference;
  readonly state: unknown;
}

export interface ImportCampaignInput {
  readonly json: string;
  readonly expectedScenario: ScenarioReference;
}

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

const ScenarioReferenceSchema = z
  .object({
    id: z.string().regex(/^scn_[a-z0-9_]+$/),
    revision: z.number().safe().int().positive(),
    canonicalHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .readonly();

const CampaignExportSchema = z
  .object({
    exportVersion: z.literal(1),
    exportedStateHash: z.string().regex(/^[a-f0-9]{64}$/),
    scenario: ScenarioReferenceSchema,
    state: z.unknown(),
  })
  .strict()
  .readonly();

const validateExpectedScenario = (value: ScenarioReference): ScenarioReference =>
  ScenarioReferenceSchema.parse(value);

export const createCampaignExport = (input: ExportCampaignInput): CampaignExport => {
  const scenario = validateExpectedScenario(input.scenario);
  const exportedStateHash = hashCanonical(input.state);
  return Object.freeze({
    exportVersion: 1,
    exportedStateHash,
    scenario,
    state: input.state,
  });
};

export const serializeCampaignExport = (input: ExportCampaignInput): string =>
  canonicalStringify(createCampaignExport(input));

export const importCampaignExport = (input: ImportCampaignInput): CampaignExport => {
  if (Buffer.byteLength(input.json, "utf8") > MAX_IMPORT_BYTES) {
    throw new RangeError("IMPORT_TOO_LARGE");
  }
  const expectedScenario = validateExpectedScenario(input.expectedScenario);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.json);
  } catch {
    throw new TypeError("IMPORT_MALFORMED_JSON");
  }
  const parsed = CampaignExportSchema.parse(parsedJson);
  if (
    parsed.scenario.id !== expectedScenario.id ||
    parsed.scenario.revision !== expectedScenario.revision ||
    parsed.scenario.canonicalHash !== expectedScenario.canonicalHash
  ) {
    throw new RangeError("SCENARIO_HASH_MISMATCH");
  }
  if (hashCanonical(parsed.state) !== parsed.exportedStateHash) {
    throw new RangeError("STATE_HASH_MISMATCH");
  }
  return Object.freeze(parsed);
};
