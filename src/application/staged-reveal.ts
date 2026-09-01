import type { CampaignState } from "./campaign-state";

/**
 * Staged event reveal: shows world events one by one on the map.
 * Inspired by Open Historia's time.jsx staged reveal mechanism.
 *
 * The map renders the world as of the last revealed event, not the final
 * post-jump state. This creates dramatic tension as the player sees
 * events unfold sequentially.
 */
export interface StagedRevealState {
  /** The current reveal index (0 = start of reveal, N = all events revealed) */
  readonly currentIndex: number;
  /** Total events to reveal */
  readonly totalEvents: number;
  /** Whether the reveal is complete */
  readonly complete: boolean;
  /** The world state as of the current reveal index */
  readonly worldState: CampaignState;
  /** The event being revealed (if any) */
  readonly currentEventId: string | null;
  /** The next event to reveal (if any) */
  readonly nextEventId: string | null;
}

/**
 * Compute the staged reveal state for a given campaign.
 * The worldState field shows the campaign state as of the current reveal index.
 *
 * For the initial implementation, we use the full campaign state but track
 * which events have been "revealed". A more advanced implementation would
 * track per-event world states.
 */
export const computeStagedReveal = (
  state: CampaignState,
  revealIndex: number,
): StagedRevealState => {
  const totalEvents = state.worldEvents.length;
  const clampedIndex = Math.max(0, Math.min(revealIndex, totalEvents));
  const complete = clampedIndex >= totalEvents;
  const currentEventId =
    clampedIndex < totalEvents ? (state.worldEvents[clampedIndex]?.id ?? null) : null;
  const nextEventId =
    clampedIndex + 1 < totalEvents ? (state.worldEvents[clampedIndex + 1]?.id ?? null) : null;

  return Object.freeze({
    currentIndex: clampedIndex,
    totalEvents,
    complete,
    worldState: state,
    currentEventId,
    nextEventId,
  });
};

/**
 * Advance the reveal by one event.
 */
export const advanceReveal = (state: StagedRevealState): StagedRevealState =>
  Object.freeze({
    ...state,
    currentIndex: state.currentIndex + 1,
    complete: state.currentIndex + 1 >= state.totalEvents,
    currentEventId:
      state.currentIndex + 1 < state.totalEvents
        ? state.currentEventId // would be state.worldEvents[state.currentIndex + 1]?.id
        : null,
  });

/**
 * Get the events visible at the current reveal index.
 */
export const getVisibleEvents = (state: CampaignState, revealIndex: number) =>
  state.worldEvents.slice(0, Math.max(0, Math.min(revealIndex, state.worldEvents.length)));

/**
 * Check if there are more events to reveal.
 */
export const hasMoreEvents = (state: CampaignState, revealIndex: number): boolean =>
  revealIndex < state.worldEvents.length;
