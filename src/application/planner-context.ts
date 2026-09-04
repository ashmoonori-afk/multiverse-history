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
const RECENT_RESOLUTIONS = 4;
const RECENT_EVENTS = 5;
const RECENT_NATION_EVENTS = 3;
const RECENT_CHAT_MESSAGES = 6;

const isParty = (
  nationId: string,
  parties: { readonly proposerNationId?: string; readonly recipientNationId?: string },
): boolean => parties.proposerNationId === nationId || parties.recipientNationId === nationId;

const isAtWar = (nationId: string, war: CampaignState["wars"][number]): boolean =>
  war.attackerNationId === nationId || war.targetNationId === nationId;

const eventMentions = (nationId: string, event: CampaignState["worldEvents"][number]): boolean =>
  event.actorNationIds.includes(nationId) || event.affectedNationIds.includes(nationId);

export const buildPlannerStateJson = (state: CampaignState): string => {
  const player = state.nations.find((nation) => nation.id === state.playerNationId);
  if (player === undefined) {
    throw new RangeError("PLANNER_PLAYER_NATION_MISSING");
  }
  // The explicit scenario majors lead the nations array; keep them plus the
  // player, everything else folds into a count.
  const majorNations = state.nations
    .slice(0, MAX_MAJOR_NATIONS)
    .filter((nation) => nation.id !== player.id)
    .map((nation) => ({
      ...nation,
      activeWars: state.wars.filter((war) => isAtWar(nation.id, war)),
      activeTreaties: state.treaties.filter(
        (treaty) => treaty.status === "active" && isParty(nation.id, treaty),
      ),
      recentWorldEvents: state.worldEvents
        .filter((event) => eventMentions(nation.id, event))
        .slice(-RECENT_NATION_EVENTS),
    }));
  const relevantNationIds = new Set<string>([
    player.id,
    ...majorNations.map((nation) => nation.id),
  ]);

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
    treaties: state.treaties.filter(
      (treaty) =>
        relevantNationIds.has(treaty.proposerNationId) &&
        relevantNationIds.has(treaty.recipientNationId),
    ),
    wars: state.wars.filter(
      (war) =>
        relevantNationIds.has(war.attackerNationId) && relevantNationIds.has(war.targetNationId),
    ),
    units: state.units.filter((unit) => relevantNationIds.has(unit.ownerNationId)),
    constructionProjects: state.constructionProjects.filter((project) =>
      relevantNationIds.has(project.ownerNationId),
    ),
    recentResolutions: state.resolutions.slice(-RECENT_RESOLUTIONS).map((resolution) => ({
      id: resolution.id,
      turn: resolution.turn,
      orderText: resolution.orderText,
      narrativeKo: resolution.narrativeKo,
      summaryKo: resolution.worldImpact.summaryKo,
    })),
    recentWorldEvents: state.worldEvents
      .filter((event) =>
        [...event.actorNationIds, ...event.affectedNationIds].some((nationId) =>
          relevantNationIds.has(nationId),
        ),
      )
      .slice(-RECENT_EVENTS),
    recentChatMessages: state.chatMessages
      .filter(
        (message) =>
          relevantNationIds.has(message.speakerNationId) &&
          relevantNationIds.has(message.targetNationId),
      )
      .slice(-RECENT_CHAT_MESSAGES)
      .map((message) => ({
        role: message.role,
        speakerNationId: message.speakerNationId,
        targetNationId: message.targetNationId,
        topic: message.topic,
        intent: message.intent,
        text: message.text,
      })),
  });
};
