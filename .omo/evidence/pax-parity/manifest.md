# Pax Parity Evidence Manifest

Status values: `RED`, `GREEN`, `PASS`, `FAIL`, `PENDING`.

## SC1 — Open sectors and quote grounding

- Status: PASS
- RED:
  - Baseline `bun run typecheck`: exit 2.
  - Baseline `bun run test`: 161 pass / 5 fail.
  - Baseline `bun run check`: exit 1.
- GREEN:
  - Fable unsandboxed `bun run typecheck`: exit 0.
  - Fable unsandboxed `bun run check`: exit 0.
  - Fable unsandboxed `bun run test`: 167 pass / 0 fail.
- Codex logs:
  - `wp0-codex.log`
  - `wp0b-codex.log`
- Commits:
  - `402014c feat(planner): open construction sectors and quote-grounded player intents`
  - `6955765 refactor(events): split event impact reducers under the complexity limit`
  - `076a47f feat(scenario): historical world scenarios, disputed overlays and turn presentation`
- Cleanup: no runtime resources spawned.

## SC2 — CampaignState v2 migration

- Status: PASS.
- RED:
  - Codex WP1 log contains seven failing targeted tests before implementation.
- GREEN:
  - Targeted WP1/WP1b tests: 35 pass / 0 fail.
  - Full `bun run test`: 178 pass / 0 fail.
  - `bun run typecheck`: exit 0.
  - `bun run check`: exit 0; generated-geometry size warning only.
  - LSP diagnostics: zero errors in provider/application/client state modules.
  - Schema module pure LOC: 64 / 189 / 172 / 182.
- Real surface:
  - Invocation: `curl -i -X POST http://localhost:3000/api/campaign/import
    -H "content-type: application/json" --data-binary @<v1-fixture.json>`
  - PASS: HTTP 200; response campaign has `schemaVersion:2`; returned state hash
    matches a subsequent GET `/api/campaign/state-hash`.
  - Artifact: `sc2-v1-import.http.txt`.
- Cleanup: `bash_13` killed; no LISTENING socket on 31047; QA-only files removed.
- Commit: `09a0257`.

## SC3 — Unified advance transaction

- Status: PASS.
- `sc3-advance-90.http.txt`: HTTP 200, turn +1, elapsedDays +90 and
  tick-attributed deltas.
- Preview retains `campaign/plan/stateHash`; timeline jump retains
  `campaign/stateHash`.
- Cleanup: `bash_25` killed, port 31048 free, QA source removed.
- Commit: `5461c46`.

## SC4 — Open-ended action and illegal movement

- Status: PASS.
- Airport construction produces an explicit intent, never an unrecognized
  error; non-adjacent movement preserves the unit and records `action.fail`.
- Actor-bound adversarial tests cover NPC/player sovereignty.
- Commits: `a1ef69a`, `d304f8d`, `cf97d46`.

## SC5 — Horizon, result attribution, and save-slot UI

- Status: PASS.
- RED: initial WP6 focused tests 0/5.
- GREEN: client tests 34/34 and dedicated Chrome Playwright 1/1.
- Evidence: `wp6-result-{375,768,1280}.png`,
  `wp6-save-{375,768,1280}.png`, `wp6-zoom-200.png`,
  `browser-action-log.md`.
- Dual visual-QA reviewers PASS on the final same-build captures.
- Cleanup: exact ports 3100/5273 free after runner shutdown.
- Commit: `fdb92a0`.

## SC6 — Documentation, spaghetti audit, and final gates

- Status: PASS.
- AGENTS/docs tracked and current; audit recorded in the ultrawork notepad.
- Forbidden clock/random/web-to-src audits pass.
- Final gates: typecheck 0; check 0; test 303/0; build 0.
- Commits: `c4d7803`, `170a478`, `cf97d46`, `f9d579e`,
  `4e4eb1b`, `882404c`.

## Completion gate

- All six statuses PASS: PASS.
- No live QA resources: PASS.
- Notepad current: PASS.
