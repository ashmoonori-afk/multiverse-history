import { canonicalStringify } from "../shared/canonical-json";
import type { CampaignState } from "./campaign-state";

/**
 * Decision-relevant slice of the campaign for the LLM planner prompt.
 *
 * The full state carries ~250 neutral fallback nations and their provinces;
 * serializing all of it multiplies planner latency and drowns the signal.
 * The planner only needs: the player, the major powers it can act with or
 * against, their provinces (valid intent targets), live diplomacy state, and
 * recent history for narrative continuity.
 */
/** The scenario's explicit major powers lead the nations array. */
const MAX_MAJOR_NATIONS = 10;
const RECENT_RESOLUTIONS = 2;
const RECENT_EVENTS = 5;
const RECENT_CHAT_MESSAGES = 6;

export const buildPlannerStateJson = (state: CampaignState): string => {
  const player = state.nations.find((nation) => nation.id === state.playerNationId);
  if (player === undefined) {
    throw new RangeError("PLANNER_PLAYER_NATION_MISSING");
  }
  // The explicit scenario majors lead the nations array; keep them plus the
  // player, everything else folds into a count.
  const majorNations = state.nations
    .slice(0, MAX_MAJOR_NATIONS)
    .filter((nation) => nation.id !== player.id);
  const relevantNationIds = new Set([player.id, ...majorNations.map((nation) => nation.id)]);

  return canonicalStringify({
    campaign: {
      scenarioId: state.scenarioId,
      playerNationId: state.playerNationId,
      difficulty: state.difficulty,
      turn: state.turn,
      date: state.date,
      elapsedDays: state.elapsedDays,
    },
    playerNation: player,
    majorNations,
    otherNationCount: state.nations.length - relevantNationIds.size,
    provinces: state.provinces.filter((province) => relevantNationIds.has(province.ownerNationId)),
    relations: state.relations.filter(
      (relation) =>
        relevantNationIds.has(relation.fromNationId) && relevantNationIds.has(relation.toNationId),
    ),
    treaties: state.treaties,
    wars: state.wars,
    units: state.units,
    constructionProjects: state.constructionProjects,
    recentResolutions: state.resolutions.slice(-RECENT_RESOLUTIONS).map((resolution) => ({
      id: resolution.id,
      turn: resolution.turn,
      orderText: resolution.orderText,
      narrativeKo: resolution.narrativeKo,
      summaryKo: resolution.worldImpact.summaryKo,
    })),
    recentWorldEvents: state.worldEvents.slice(-RECENT_EVENTS),
    recentChatMessages: state.chatMessages.slice(-RECENT_CHAT_MESSAGES).map((message) => ({
      role: message.role,
      speakerNationId: message.speakerNationId,
      targetNationId: message.targetNationId,
      topic: message.topic,
      intent: message.intent,
      text: message.text,
    })),
  });
};
