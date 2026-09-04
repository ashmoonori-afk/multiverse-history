import { parseNationId } from "../shared/ids";
import type { CampaignState } from "./campaign-state";
import { resolveOwnershipAtEvent } from "./event-impact";

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
  const ownership = resolveOwnershipAtEvent(state, clampedIndex);
  const worldState = Object.freeze({
    ...state,
    provinces: Object.freeze(
      state.provinces.map((province) =>
        Object.freeze({
          ...province,
          ownerNationId: parseNationId(ownership.get(province.id) ?? province.ownerNationId),
        }),
      ),
    ),
  });

  return Object.freeze({
    currentIndex: clampedIndex,
    totalEvents,
    complete,
    worldState,
    currentEventId,
    nextEventId,
  });
};

/**
 * Advance the reveal by one event.
 */
export const advanceReveal = (state: StagedRevealState): StagedRevealState =>
  computeStagedReveal(state.worldState, state.currentIndex + 1);

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
