# tests

Score 11, distinct domain (94 TS/TSX files, 10 subdirs, two different runners).

## OVERVIEW
Two independent suites: `bun test` for everything in-process, Playwright for `tests/e2e` against real servers.

## STRUCTURE
```
tests/
├── e2e/          playwright, *.e2e.ts                  ├── application/
│   └── helpers/   1 file   shared campaign flows      ├── persistence/  3
├── api/          createGameApp in-process             ├── integration/
├── domain/       pure rules                           ├── shared/
├── providers/    schemas, CLI adapters                └── fixtures/
└── web/          client projections and schema mirrors
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Drive a campaign in E2E | `e2e/helpers/open-historia.ts` (27 inbound refs) |
| API behavior without HTTP | `api/*.integration.test.ts` — import `createGameApp` directly |
| Provider failure/atomicity | `integration/provider-errors.integration.test.ts` |
| Recorded provider payloads | `fixtures/provider-{deterministic,empty,malformed}.json` |

## CONVENTIONS
- `bun run test` enumerates its eight directories explicitly, which is how `tests/e2e` stays out of it. **A new top-level test directory does not run until it is added to `package.json`.**
- Naming splits the runners: `*.e2e.ts` for Playwright, `*.test.ts` (often `*.integration.test.ts`) for Bun.
- Tests are structured with `// Given` / `// When` / `// Then` comment blocks.
- Determinism comes from selecting the `deterministic` provider and injecting authors/runners through `createGameApp` options — not from network mocking, recorded HTTP, or a fake clock.
- E2E asserts UI text against values read from the API response (`e2e/action-news-flow.e2e.ts:53-59`), so Korean copy changes do not break it; hardcoding expected prose instead would.
- Playwright runs serially (`workers: 1`, `fullyParallel: false`), locale `ko-KR`, 30 s test / 10 s expect timeouts, desktop + mobile viewport projects.

## ANTI-PATTERNS
- Do not run `bun run dev` while running `test:e2e`: the config boots its own API (3000) and web (5173) with `reuseExistingServer: false`.
- `providers/process-runner.test.ts` shells out to real `codex` and `claude` binaries and asserts exit code 0 — it fails on machines without them installed and authenticated. That is an environment gap, not a regression.
- `noSkippedTests` is a Biome error: do not park a failing test with `.skip`.
- Prefer `expect.poll` for MapLibre state that settles asynchronously (`e2e/map-consequences.e2e.ts:68`) over fixed waits.

## COMMANDS
```bash
bun test tests/api/campaign-turns.integration.test.ts   # single file
bun test tests/providers                                # single dir
playwright test tests/e2e/action-news-flow.e2e.ts --project=desktop
```
