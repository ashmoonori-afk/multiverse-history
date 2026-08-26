import { z } from "zod";

import { parseScenarioId } from "../../shared/ids";
import type { ScenarioPackageMetadata } from "./types";

const ScenarioPackageMetadataSchema = z
  .object({
    schema: z.literal("multiverse-history-scenario/1"),
    id: z.string().transform(parseScenarioId),
    titleKo: z.string().trim().min(1).max(120),
    era: z.string().trim().min(1).max(80),
    genre: z.string().trim().min(1).max(80),
    year: z.number().safe().int(),
    licenseSpdx: z.string().trim().min(1).max(120),
    authors: z.array(z.string().trim().min(1).max(120)).min(1).readonly(),
    sourceManifest: z.array(z.string().trim().min(1).max(500)).min(1).readonly(),
    assetManifest: z.array(z.string().trim().min(1).max(500)).min(1).readonly(),
  })
  .strict()
  .readonly();

export const validateScenarioPackageMetadata = (value: unknown): ScenarioPackageMetadata =>
  ScenarioPackageMetadataSchema.parse(value);
