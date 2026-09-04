# src/application

Score 12 (32 TS files, 4978 LOC) — the heaviest and most-referenced subtree.

## OVERVIEW
Orchestration layer between `src/api` and `src/domain`: owns the campaign aggregate, the turn transaction, and the assembly of a turn's resolution, narrative, news and reactions.

## WHERE TO LOOK
| Task | File |
|------|------|
| Campaign shape, parsing, in-memory store | `campaign-state.ts`, `campaign-state-migration.ts` |
| Turn commit, optimistic concurrency, error codes | `turn-transaction.ts` |
| Clamp an LLM plan to legal ids before applying | `ground-strategic-plan.ts` |
| Turn reduction: apply plan intents to state | `apply-strategic-plan.ts`, `policy-intent-reducers.ts` |
| Deterministic quarterly progression | `simulation-tick.ts`, `simulation-tick-*.ts` |
| Post-reduction news + reactions | `campaign-turn-finalization.ts`, `campaign-news-finalization.ts`, `campaign-world-feedback.ts` |
| Delta computation + Korean turn summary | `campaign-resolution.ts` (314L), `campaign-resolution-entities.ts` |
| Reduced state sent to the LLM planner | `planner-context.ts` |
| World event generation and impact | `world-event-engine.ts`, `campaign-world-event.ts`, `event-impact.ts` |
| Unified advance / compatibility adapters | `campaign-timeline-progression.ts`, `campaign-progression.ts`, `staged-reveal.ts` |
| Diplomacy chat rooms and decisions | `campaign-chat.ts`, `campaign-chat-decision.ts`, `campaign-group-chat.ts` |
| Treaties, transfers, wars, recruitment | `warfare-actions.ts` |

## CONVENTIONS
- This layer may import `src/providers` (for `StrategicPlan` and author types) and `src/domain`. Nothing here may be imported back by `src/domain`.
- Every persisted structure exposes a `XSchema` plus a `parseX`; `parseCampaignState` is the single re-hydration path and is re-run on every `store.replace`.
- Transitions are pure: take a snapshot, return a new state. The store is written once, at commit.
- `/api/turns/advance` resolves player policy, NPC policy, deterministic ticks,
  finalization and autosave in one transaction. Preview and timeline jump adapt
  their legacy bodies to that pipeline.
- Resolution deltas retain `source: "policy" | "tick"` provenance. Event
  impacts reduce sequentially so each event sees the state produced by the
  previous event; staged reveal reconstructs ownership from those records.
- Finalization work that is independent runs concurrently (`campaign-turn-finalization.ts` resolves feedback and news together); NPC reactions are one batched provider call, not per-nation calls.

## ANTI-PATTERNS
- Never apply NPC intents before player intents — order is fixed and observable in resolutions.
- Never advance `turn` or write the store outside `executeProviderTurn`; the request-id and pre/post state-hash checks exist to produce `campaign_conflict` instead of silent double-application.
- Simulation ticks never call providers, persist files, or format UI copy.
- Never add a field to `CampaignState` without also updating the client mirror in `web/src/state/campaign-store.ts` (the client re-declares, never imports, these schemas) and considering export-hash compatibility.
- Never grow `planner-context.ts` output "just to be safe" — it is deliberately a decision-relevant slice.
- Do not spawn processes or touch the filesystem here; that belongs to `src/providers` and `src/persistence`.
