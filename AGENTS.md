# PROJECT KNOWLEDGE BASE

**Generated:** 2026-09-04
**Commit:** b8f931c
**Branch:** main

## OVERVIEW
Turn-based alternate-history grand strategy (1900 East Asia, Korean-language): the player writes a free-text order, an LLM CLI subprocess (Codex/Claude) acts as strategic planner for player + NPC nations, and the reduced result is rendered on a MapLibre map. Bun + Hono API, React 18 + Vite + zustand client, Zod at every boundary.

## STRUCTURE
```
Pax-Historia-AI/
├── src/
│   ├── api/            # Hono app; app.ts alone wires every route + provider maps
│   ├── application/    # schema v2 state/migration, turn transaction, simulation ticks
│   ├── domain/         # game rules + scenario profiles, units, generated adjacency
│   ├── providers/      # LLM subprocess adapters, Korean prompts, output schemas
│   ├── persistence/    # canonical import/export + atomic campaign save slots
│   ├── shared/         # branded ids, canonical JSON hashing, historical map contract
│   └── cli/            # provider diagnose/smoke entry points
├── web/                # Vite root is here, NOT the repo root
├── tests/              # bun test (8 dirs) + playwright (tests/e2e only)
├── scripts/            # build-east-asia-geometry.py regenerates map GeoJSON
└── DESIGN.md           # gitignored product doc; drifts from code, code wins
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add/change an HTTP route | `src/api/app.ts` | one `createGameApp` builds routes + provider maps |
| Change what a turn does | `src/application/turn-transaction.ts`, `campaign-timeline-progression.ts`, `simulation-tick.ts` | `/api/turns/advance` is canonical; preview/jump are adapters |
| Change persisted campaign shape | `src/application/campaign-state.ts`, `campaign-state-migration.ts` | schema v2; v1 imports migrate after legacy-hash verification |
| Change save-slot behavior | `src/persistence/campaign-slot-store.ts` | atomic temp-write + rename under `data/campaigns/` |
| Change LLM prompt or output shape | `src/providers/prompt.ts`, `src/providers/schemas.ts` | prompt is Korean; wire schema normalizes into core |
| Add a nation/province | `src/domain/scenario/east-asia-1900/`, `scenario/adjacency/` | profiles, units and graph are domain data; geometry stays under `web/` |
| Add/adjust a historical scenario | `src/domain/scenario/historical-scenario.ts`, `src/shared/historical-map-contract.ts` | 9 of 10 built-ins are generated from a fetched world basemap |
| Map rendering / layers | `web/src/features/map/` | style constants hand-mirror CSS tokens |
| Client state or any API call | `web/src/state/campaign-store.ts` | zustand store owns nearly every `fetch` |
| E2E flows | `tests/e2e/helpers/open-historia.ts` | 27 inbound refs; widest blast radius in tests |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `useCampaignStore` + `Campaign` | store/types | `web/src/state/campaign-store.ts` | 22 | all client state and API I/O |
| `StrategicPlan`, `strategicPlanCore` | schema | `src/providers/schemas.ts` | 19 | LLM output contract; `core` strips `presentation` |
| `CampaignState`, `parseCampaignState`, `LocalCampaignStore` | schema/store | `src/application/campaign-state.ts` | — | schema-v2 campaign aggregate |
| `runSimulationTicks` | simulation | `src/application/simulation-tick.ts` | — | deterministic quarterly world progression |
| `CampaignSlotStore` | persistence | `src/persistence/campaign-slot-store.ts` | — | atomic named saves and autosave |
| `parseNationId`, `parseScenarioId` | branded ids | `src/shared/ids.ts` | 16 | `nat_`/`scn_` regex brands |
| `createGameApp` | factory | `src/api/app.ts` | 15 | composition root; tests import it directly |
| `canonicalStringify`, `hashCanonical` | util | `src/shared/canonical-json.ts` | 14 | deterministic hashing for optimistic concurrency + export |
| `runProviderProcess` | adapter | `src/providers/process-runner.ts` | 11 | only sanctioned subprocess spawn |
| `getScenarioById` | registry | `src/domain/scenario/registry.ts` | 8 | scenario lookup + neutral-country merge |
| `executeProviderTurn`, `ProviderTurnError` | transaction | `src/application/turn-transaction.ts` | 6 | the only place `turn` increments |

## CONVENTIONS
- `tsconfig.json` is maximally strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`). Consequence: optional properties are conditionally spread, never assigned `undefined` — `...(x === undefined ? {} : { x })` (`src/api/app.ts:191,210`).
- Biome, not ESLint/Prettier: 100 col, double quotes, trailing commas. `noExplicitAny`, `noNonNullAssertion`, `noExcessiveCognitiveComplexity`, `noSkippedTests` are **errors**.
- Zod at every boundary, with branded/regex ids: `nat_`/`scn_` (`src/shared/ids.ts:3-10`), `prv_` (`src/application/campaign-construction.ts:7`), `try_` (`src/domain/diplomacy/treaties.ts:32`).
- Dependency injection is plain function parameters — planners, news/reaction authors and event factories are passed into `createGameApp` options and `finalizeCampaignTurn`. No container, no class hierarchy.
- Errors are typed with machine codes: `ProviderTurnError(status, code)`; elsewhere `RangeError`/`TypeError` carrying SCREAMING_SNAKE codes (`CAMPAIGN_NOT_STARTED`, `STATE_HASH_MISMATCH`). Never a raw string throw.
- Schema and inferred type are colocated in one file (`XSchema` + `X`); returned aggregates are `Object.freeze`d.
- Korean is contractual, not cosmetic: prompt instructions, narrative, article and reactions must be Korean (`src/providers/prompt.ts:13-59`); data fields carry the `Ko` suffix.
- File naming: kebab-case in `src/`, PascalCase `.tsx` components in `web/`.

## ANTI-PATTERNS (THIS PROJECT)
- Do not introduce `Math.random()` or wall-clock reads in `src/` — none exist; turn output must be reproducible from campaign state plus provider output.
- Do not widen the planner payload back to full state. `buildPlannerStateJson` exists because the 251-nation state multiplies latency without adding signal (`src/api/app.ts:497-499`).
- Do not increment `turn` or call `store.replace` outside `executeProviderTurn`; the optimistic request-id and state-hash checks guard it.
- Do not hand-edit `web/src/features/map/geometry/*.json` — generated, 3.4 MB, regenerate via `scripts/build-east-asia-geometry.py`.
- Do not change `CampaignState` or canonical key ordering without accounting for export compatibility: import re-checks scenario id, revision, canonical hash **and** state hash (`src/persistence/export-import.ts:78-87`).
- Do not import `src/` from `web/` — verified zero such imports; the client re-declares the schemas it needs.

## UNIQUE STYLES
- The API composition root remains `createGameApp`; route handlers delegate advance, migration and slot work to named modules.
- Provider output is never regex-scraped — subprocess stdout is JSON-parsed then Zod-validated, and failures become typed `provider_*` error codes.
- Tests are written with explicit `// Given` / `// When` / `// Then` comment blocks.

## COMMANDS
```bash
bun run dev            # api (3000) + web (5173) in parallel
bun run test           # bun test, 8 dirs, EXCLUDES tests/e2e
bun run test:e2e       # playwright; boots both servers itself
bun run typecheck      # tsc --noEmit
bun run check          # biome check .   (check:write to fix)
bun run build          # build:api (bun) + build:web (vite -> dist/web)
```

## NOTES
- Intentional large boundaries: `src/api/app.ts` is the composition root,
  `campaign-state.ts` is the aggregate schema/store boundary,
  `web/src/state/campaign-store.ts` is the sole client I/O owner, and
  `east-asia-1900/nations.ts` is declarative scenario data. Keep new behavior
  in focused modules rather than expanding these boundaries.
- The active campaign is in-memory, while explicit saves and autosave persist atomically as `data/campaigns/<slot>.json`.
- Player gameplay defaults to Codex; deterministic planning remains available for tests and rules-mode verification.
- `test:e2e` sets `reuseExistingServer: false` on both servers: an already-running `bun run dev` makes the e2e suite fail on port conflict.
- Playwright writes its JSON report to `.omo/evidence/C001/playwright.json`, inside the gitignored `.omo/`.
- Gitignored runtime artifacts include `DESIGN.md`, `data/campaigns/`, `dist/`
  and `test-results/`; required scenario contract documents are force-tracked.
- Scenarios come in two flavours: `scn_ea1900` is hand-authored, the other nine built-ins are generated at load time from `aourednik/historical-basemaps` (GPL-3.0) via `loadHistoricalScenario`. That is the only network call in `src/domain`.
- Campaign slot hashes are corruption checksums for local saves, not hostile
  authentication. Slot writes use unique exclusive temp files and atomic
  replacement.
