import * as isoCountries from "i18n-iso-countries";
import englishLocale from "i18n-iso-countries/langs/en.json";
import koreanLocale from "i18n-iso-countries/langs/ko.json";

import { parseNationId } from "../../shared/ids";
import type { CanonicalCountry, PlayableNationStart } from "./types";

isoCountries.registerLocale(englishLocale);
isoCountries.registerLocale(koreanLocale);

const legalActions = Object.freeze([
  "economy.invest",
  "diplomacy.propose_treaty",
  "military.recruit",
]);

const buildCanonicalCountries = (): readonly CanonicalCountry[] =>
  Object.freeze(
    Object.keys(isoCountries.getAlpha2Codes())
      .sort()
      .map((alpha2) => {
        const alpha3 = isoCountries.alpha2ToAlpha3(alpha2);
        const numericCode = isoCountries.alpha2ToNumeric(alpha2);
        const nameKo = isoCountries.getName(alpha2, "ko");
        const nameEn = isoCountries.getName(alpha2, "en");
        if (
          alpha3 === undefined ||
          numericCode === undefined ||
          nameKo === undefined ||
          nameEn === undefined
        ) {
          throw new RangeError(`Incomplete ISO country record: ${alpha2}`);
        }
        return Object.freeze({
          id: parseNationId(`nat_${alpha3.toLowerCase()}`),
          alpha2,
          alpha3,
          numericCode,
          nameKo,
          nameEn,
        });
      }),
  );

const canonicalCountries = buildCanonicalCountries();

export const listCanonicalCountries = (): readonly CanonicalCountry[] => canonicalCountries;

export const createPlayableNationStart = (alpha2: string): PlayableNationStart => {
  const country = canonicalCountries.find((candidate) => candidate.alpha2 === alpha2.toUpperCase());
  if (country === undefined) {
    throw new RangeError(`Unknown ISO country: ${alpha2}`);
  }
  const numericSeed = Number(country.numericCode);
  return Object.freeze({
    country,
    capitalLabelKo: `${country.nameKo} 수도`,
    treasuryCredits: 100 + (numericSeed % 900),
    stabilityBps: 4_500 + (numericSeed % 3_000),
    legalActions,
  });
};
