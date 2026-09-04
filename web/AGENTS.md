# web

Score 13 (45 TS/TSX files, 6849 LOC, 12 feature folders) — the Vite root, and a hard schema boundary with `src/`.

## OVERVIEW
React 18 + zustand + MapLibre client for the campaign: start screen, map, order composer, turn resolution feed, timeline, diplomacy chat.

## STRUCTURE
```
web/
├── index.html                  # Vite entry (vite.config.ts sets root: "web")
└── src/
    ├── main.tsx                # imports every global CSS file
    ├── app/                    # App, StartScreen, CampaignShell, CampaignAdvisor, setup catalog
    ├── state/                  # zustand store + client-side Zod mirrors of server shapes
    ├── styles/                 # tokens.css (design tokens), shell.css, open-historia.css
    └── features/               # map, resolution, timeline, diplomacy, hud, orders, military,
                                # inspector, library, presets, setup, controls
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Any API call, any campaign state | `src/state/campaign-store.ts` (883L) |
| Response shape mirrors of the server | `src/state/campaign-resolution-schema.ts`, `src/state/campaign-world-schema.ts` |
| Order submission and turn commit UI | `src/app/CampaignShell.tsx` |
| Horizon mapping + all API I/O | `src/state/campaign-store.ts` |
| Save-slot list/save/load UI | `src/features/library/SaveMenu.tsx` |
| Policy/tick result grouping | `src/features/resolution/ResolutionDeltaGroups.tsx` |
| Map layers, sources, palette | `src/features/map/open-historia-map-style.ts` |
| Province geometry + metadata joins | `src/features/map/east-asia-map.ts`, `open-historia-map-data.ts` |
| Historical scenarios: fetch + convert basemap | `src/features/map/historical-map.ts`, `use-historical-scenario-map.ts` |
| Disputed-territory hatch pattern (canvas image) | `src/features/map/disputed-hatch.ts` |
| Colors, spacing, fonts | `src/styles/tokens.css` |
| BC/AD year formatting | `src/app/campaign-date.ts` |

## CONVENTIONS
- The zustand store owns campaign state **and** every API call; components hold only transient UI state. The one exception is the setup catalog fetch in `src/app/StartScreen.tsx:47`.
- Server schemas are **re-declared** here, never imported — there are zero `web/ -> src/` imports. Any server shape change must be mirrored by hand in `src/state/*.ts`.
- Styling is CSS files plus custom properties; global sheets are imported from `main.tsx`, feature sheets sit beside their component. No inline styles, no CSS-in-JS.
- Map palette constants duplicate the CSS tokens on purpose: MapLibre paints on a WebGL canvas and cannot read custom properties (`src/features/map/open-historia-map-style.ts:14-22`). Change a map color in both places.
- Korean copy is inline in JSX; data fields use the `Ko` suffix; Noto Sans/Serif KR are loaded explicitly.
- Turn submission maps week/month/quarter/year to 7/30/91/365-day
  `/api/turns/advance` horizons and sends the current expected-state hash.
- Result surfaces keep policy and simulation deltas separate through
  `resolution-policy-deltas` and `resolution-tick-deltas`; the result panel
  owns its internal scroll at narrow widths and zoom.
- `data-testid` is a contract with `tests/e2e`, used across 29 files, including dynamic ids and state-carrying attributes such as `data-selected-id`, `data-unit-count`, `data-cadence`.

## ANTI-PATTERNS
- Never hand-edit `src/features/map/geometry/*.json` (3.4 MB, generated) — regenerate with `scripts/build-east-asia-geometry.py`.
- Never add a `fetch` outside `campaign-store.ts`.
- Never rename or drop a `data-testid` without updating `tests/e2e` in the same change.
- Never mutate store state directly; go through `set`.
- Save-slot methods and every other fetch remain in `campaign-store.ts`; UI
  components receive typed callbacks only.
- Remember Vite's root is `web/`, so scripts run from the repo root must pass `--config vite.config.ts`.
