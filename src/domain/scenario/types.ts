import type { NationId, ScenarioId } from "../../shared/ids";

export interface CanonicalCountry {
  readonly id: NationId;
  readonly alpha2: string;
  readonly alpha3: string;
  readonly numericCode: string;
  readonly nameKo: string;
  readonly nameEn: string;
}

export interface PlayableNationStart {
  readonly country: CanonicalCountry;
  readonly capitalLabelKo: string;
  readonly treasuryCredits: number;
  readonly stabilityBps: number;
  readonly legalActions: readonly string[];
}

export interface ScenarioPackageMetadata {
  readonly schema: "multiverse-history-scenario/1";
  readonly id: ScenarioId;
  readonly titleKo: string;
  readonly era: string;
  readonly genre: string;
  readonly year: number;
  readonly licenseSpdx: string;
  readonly authors: readonly string[];
  readonly sourceManifest: readonly string[];
  readonly assetManifest: readonly string[];
}
