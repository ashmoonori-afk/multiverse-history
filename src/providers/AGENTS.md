# src/providers

Score 9, distinct domain (20 TS files, 2329 LOC) — the only layer allowed to leave the process.

## OVERVIEW
Adapters that turn Codex/Claude CLI subprocesses into schema-validated game output, plus the deterministic planner used by tests and rules-mode verification.

## WHERE TO LOOK
| Task | File |
|------|------|
| Spawn a provider binary, timeout, output caps | `process-runner.ts` (225L) |
| Structured call: schema file vs JSON envelope, typed failures | `structured-invocation.ts` |
| Turn planner: temp workspace, prompt, parse, cleanup | `live-planner.ts` |
| The Korean planner prompt itself | `prompt.ts` |
| Strategic intent v2 core and wire schemas | `strategic-intent-schema.ts`, `strategic-intent-wire-schema.ts` |
| Plan normalization / emitted JSON Schema | `schemas.ts`, `strategic-plan-json-schema.ts` |
| News / reaction / group-chat output contracts | `news-schema.ts`, `reaction-schema.ts`, `group-chat-schema.ts` |
| Combined article + reactions payload in one call | `turn-presentation.ts` |
| Live authors for news, reactions, diplomacy | `live-news.ts`, `live-reaction.ts`, `live-diplomacy.ts` |
| CLI argument shapes and envelope parsing | `codex-provider.ts`, `claude-provider.ts` |
| Offline planner used by tests/rules mode | `deterministic-provider.ts` |
| Startup warm-up and health checks | `provider-warmup.ts`, `diagnostics.ts` |

## CONVENTIONS
- Providers are values, not singletons: `createGameApp` builds a `Partial<Record<ProviderSelection, ...>>` map, and tests override entries through options.
- Every provider result is JSON-parsed then Zod-validated. Failures surface as `ProviderInvocationErrorCode` / `provider_*` codes, never as thrown raw text or partial data.
- `strategicPlanCore` deliberately strips `presentation` before the plan crosses the API boundary — the presentation payload is consumed during finalization, not shipped to the client.
- Prompts carry an explicit untrusted-input fence (`BEGIN_UNTRUSTED_PLAYER_ORDER` / `END_...`) and state that game state is read-only; player text is data, never instruction.
- Every intent carries an exact `sourceQuoteKo`; grounding rejects invented
  evidence. Unsupported open-ended orders become `action.fail` rather than
  disappearing or throwing.
- Prompt context includes scenario era, persona, historical baseline and
  bounded major-nation profiles. Every major NPC receives one deterministic,
  profile-driven action within the configured cap.
- `nationCount` only enters the prompt as a hint when > 4, to keep small scenarios from getting selection instructions they do not need.

## ANTI-PATTERNS
- Never regex-scrape provider stdout; add or extend a schema instead.
- Never call a provider from `src/domain` or leave a temp workspace behind after a live invocation.
- Never move Korean prompt text into `src/application` — prompt wording lives here, next to the schema it must satisfy.
- Never issue one provider call per nation for reactions; the batched single call is a deliberate latency fix.
- Adding a provider means extending `ProviderId` plus the argument/envelope pair, not branching inside `process-runner.ts`.
- Player-facing gameplay defaults to Codex; do not promote the deterministic
  adapter to a player default.
