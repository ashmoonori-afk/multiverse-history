# src/domain

Score 9, distinct domain (17 TS files, 2131 LOC) — game rules, no providers, no persistence.

## OVERVIEW
Game rules plus the scenario system: one hand-authored 1900 East Asia dataset and nine historical scenarios generated from a fetched world basemap.

## WHERE TO LOOK
| Task | File |
|------|------|
| Scenario shape, lookup, playable-nation merge, async load | `scenario/registry.ts` (186L) |
| Hand-authored nation + province data | `scenario/east-asia-1900/nations.ts`, `scenario/east-asia-1900/provinces.ts`, `initial-units.ts` |
| Generated province graphs | `scenario/adjacency/*.json`, `scenario/adjacency.ts` |
| Historical scenarios built from basemap features | `scenario/historical-scenario.ts` (250L) |
| Korean names/capitals/blocs for historical polities | `scenario/historical-scenario-overlays.ts` |
| Neutral world countries used as fallback nations | `scenario/countries.ts` |
| Scenario listing / metadata / built-ins | `scenario/catalog.ts`, `scenario/metadata.ts`, `scenario/built-ins.ts` |
| Importable scenario package validation | `scenario/package.ts` |
| Treaty clauses and treaty ids | `diplomacy/treaties.ts` |
| Quarterly economy resolution | `economy/resolve-quarter.ts` |
| Combat resolution (seeded by campaign, not RNG) | `military/combat.ts` (234L) |
| Chronicle event records | `events/chronicle.ts` |

## CONVENTIONS
- Imports are limited to `zod` and `src/shared` — verified zero imports of `src/providers` or `src/application` from this tree. Keep it that way; it is what makes these rules testable without a harness.
- **Two scenario kinds.** `scn_ea1900` has hand-authored provinces; the other nine built-ins (`built-ins.ts:31-40`) are seeded synchronously by `historicalScenarioSeed` and then filled in asynchronously by `loadHistoricalScenario`, which fetches a world snapshot (`registry.ts:155,177`). Snapshot mapping and URL live in `src/shared/historical-map-contract.ts:5-16`.
- Basemap data comes from `aourednik/historical-basemaps` (GPL-3.0, credited in `built-ins.ts:7`). Its features are validated by a strict Zod schema keyed on `NAME`/`SUBJECTO`, so upstream property renames break scenario loading, not just rendering.
- Scenario data is frozen and merged once: `registry.ts` combines East Asia with neutral global countries to build the playable-nation list, throwing at import time if metadata is missing.
- Provinces carry Korean names, symmetric adjacency, capital/port flags,
  terrain and development. Major nations carry government, tags, manpower and
  strategic profiles; authored initial units must reference owned provinces.
- `scripts/build-adjacency.py` deterministically regenerates every file under
  `scenario/adjacency/`; generated graphs are never hand-edited.

## ANTI-PATTERNS
- Combat and economy take their variability from campaign state — never add `Math.random()` or a clock read to a rule function.
- `loadHistoricalScenario` is the **only** sanctioned I/O in this tree, and it takes an injectable `fetcher` (`historical-scenario.ts:233-237`). Do not add filesystem, subprocess, or unfetchable network access anywhere else here.
- Domain adjacency and province metadata define rules; renderer geometry stays
  under `web/`. A new province still needs matching renderer metadata.
- Changing shipped scenario data changes its canonical hash and invalidates previously exported campaigns.
