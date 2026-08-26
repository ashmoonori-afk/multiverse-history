import { validateScenarioPackageMetadata } from "./metadata";
import type { ScenarioPackageMetadata } from "./types";

const originalSource = ["Public-domain historical facts; independently authored scenario"];
const originalAssets = ["Original generated geometry and deterministic neutral fallbacks"];

const builtIn = (
  id: string,
  titleKo: string,
  era: string,
  genre: string,
  year: number,
): ScenarioPackageMetadata =>
  validateScenarioPackageMetadata({
    schema: "multiverse-history-scenario/1",
    id,
    titleKo,
    era,
    genre,
    year,
    licenseSpdx: "CC0-1.0",
    authors: ["Multiverse History Team"],
    sourceManifest: originalSource,
    assetManifest: originalAssets,
  });

const builtInScenarios = Object.freeze([
  builtIn("scn_bronze_1200bc", "청동기 붕괴", "ancient", "historical", -1200),
  builtIn("scn_classical_117", "제국의 절정", "classical", "historical", 117),
  builtIn("scn_medieval_1200", "실크로드의 세계", "medieval", "historical", 1200),
  builtIn("scn_steppe_1300", "초원의 세기", "steppe", "nomadic", 1300),
  builtIn("scn_trade_1650", "대항해와 교역", "early-modern", "economic", 1650),
  builtIn("scn_ea1900", "1900 동아시아", "industrial", "historical", 1900),
  builtIn("scn_world_1939", "세계대전의 문턱", "world-war", "historical", 1939),
  builtIn("scn_coldwar_1962", "냉전의 균형", "cold-war", "alternate-history", 1962),
  builtIn("scn_modern", "오늘의 세계", "modern", "contemporary", 2026),
  builtIn("scn_reconstruction_2281", "재건기 2281", "future", "science-fiction", 2281),
]);

export const listBuiltInScenarioMetadata = (): readonly ScenarioPackageMetadata[] =>
  builtInScenarios;
