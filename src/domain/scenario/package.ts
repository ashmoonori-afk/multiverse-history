import { z } from "zod";

import { hashCanonical } from "../../shared/canonical-json";
import { listCanonicalCountries } from "./countries";

const CoordinateSchema = z.tuple([z.number().finite(), z.number().finite()]);

const ScenarioPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^scn_[a-z0-9_]+$/),
    titleKo: z.string().trim().min(1).max(120),
    era: z.string().trim().min(1).max(80),
    genre: z.string().trim().min(1).max(80),
    year: z.number().safe().int(),
    licenseSpdx: z.string().trim().min(1).max(120),
    authors: z.array(z.string().trim().min(1).max(120)).min(1),
    nations: z
      .array(
        z
          .object({
            id: z.string().regex(/^nat_[a-z0-9_]+$/),
            countryId: z.string().regex(/^nat_[a-z0-9_]+$/),
            nameKo: z.string().trim().min(1).max(120),
          })
          .strict(),
      )
      .min(1),
    regions: z
      .array(
        z
          .object({
            id: z.string().regex(/^prv_[a-z0-9_]+$/),
            ownerNationId: z.string().regex(/^nat_[a-z0-9_]+$/),
            geometry: z
              .object({
                type: z.literal("Polygon"),
                coordinates: z.array(z.array(CoordinateSchema).min(4)).min(1),
              })
              .strict(),
          })
          .strict(),
      )
      .min(1),
    assets: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            source: z.enum(["inline", "external"]),
            licenseSpdx: z.string().trim().min(1).max(120),
          })
          .strict(),
      )
      .default([]),
    canonicalHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type ScenarioPackage = z.infer<typeof ScenarioPackageSchema>;

const assertUnique = (values: readonly string[], errorCode: string): void => {
  if (new Set(values).size !== values.length) {
    throw new RangeError(errorCode);
  }
};

const canonicalCountryIds: ReadonlySet<string> = new Set(
  listCanonicalCountries().map((country) => country.id),
);

const validateGeometry = (packageValue: ScenarioPackage): void => {
  for (const region of packageValue.regions) {
    for (const ring of region.geometry.coordinates) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (
        first === undefined ||
        last === undefined ||
        first[0] !== last[0] ||
        first[1] !== last[1]
      ) {
        throw new RangeError("SCENARIO_INVALID_GEOMETRY");
      }
    }
  }
};

export const validateScenarioPackage = (value: unknown): ScenarioPackage => {
  const parsed = ScenarioPackageSchema.parse(value);
  assertUnique(
    parsed.nations.map((nation) => nation.id),
    "SCENARIO_DUPLICATE_NATION_ID",
  );
  assertUnique(
    parsed.regions.map((region) => region.id),
    "SCENARIO_DUPLICATE_REGION_ID",
  );
  if (parsed.nations.some((nation) => !canonicalCountryIds.has(nation.countryId))) {
    throw new RangeError("SCENARIO_UNKNOWN_COUNTRY");
  }
  validateGeometry(parsed);
  if (
    parsed.assets.some(
      (asset) =>
        asset.source === "external" &&
        (asset.licenseSpdx === "UNLICENSED" || asset.licenseSpdx === "NOASSERTION"),
    )
  ) {
    throw new RangeError("SCENARIO_UNLICENSED_EXTERNAL_ASSET");
  }
  const { canonicalHash, ...content } = parsed;
  if (hashCanonical(content) !== canonicalHash) {
    throw new RangeError("SCENARIO_PACKAGE_HASH_MISMATCH");
  }
  return Object.freeze(parsed);
};
