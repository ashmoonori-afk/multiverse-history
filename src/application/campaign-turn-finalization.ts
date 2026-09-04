import type { StrategicPlan } from "../providers/schemas";
import { type CampaignNewsAuthor, finalizeCampaignNews } from "./campaign-news-finalization";
import type { CampaignState } from "./campaign-state";
import type { CampaignWorldEvent } from "./campaign-world-event";
import {
  authorCampaignEventReactions,
  type CampaignReactionAuthor,
} from "./campaign-world-feedback";

export interface FinalizeCampaignTurnInput {
  readonly before: CampaignState;
  readonly reduced: CampaignState;
  readonly plan: StrategicPlan;
  readonly orderText: string;
  readonly events: readonly CampaignWorldEvent[];
  readonly reactionAuthor: CampaignReactionAuthor;
  readonly newsAuthor: CampaignNewsAuthor;
}

/**
 * Reactions and editorial news consume the same committed resolution facts,
 * so they can be authored concurrently. News intentionally does not quote
 * reactions that are still being generated in the sibling lane.
 */
export const finalizeCampaignTurn = async (
  input: FinalizeCampaignTurnInput,
): Promise<CampaignState> => {
  const presentation = input.plan.presentation;
  const reactionAuthor =
    presentation === undefined ? input.reactionAuthor : async () => presentation.reactions;
  const newsAuthor =
    presentation === undefined ? input.newsAuthor : async () => presentation.article;
  const resolution = input.reduced.resolutions.at(-1);
  if (resolution === undefined) throw new RangeError("CAMPAIGN_RESOLUTION_MISSING");
  const [reactionGroups, withNews] = await Promise.all([
    Promise.all(
      input.events.map((event) =>
        authorCampaignEventReactions({ state: input.reduced, event, reactionAuthor }),
      ),
    ),
    finalizeCampaignNews({
      before: input.before,
      reduced: input.reduced,
      plan: input.plan,
      orderText: input.orderText,
      author: newsAuthor,
    }),
  ]);
  const reactions = Object.freeze(reactionGroups.flat());
  const newsResolution = withNews.resolutions.at(-1);
  if (newsResolution === undefined) {
    throw new RangeError("CAMPAIGN_RESOLUTION_MISSING");
  }
  return Object.freeze({
    ...withNews,
    nationReactions: Object.freeze([...input.before.nationReactions, ...reactions]),
    resolutions: Object.freeze(
      withNews.resolutions.map((candidate) =>
        candidate.id === newsResolution.id
          ? Object.freeze({
              ...candidate,
              article: newsResolution.article,
              articleKo: newsResolution.articleKo,
              reactionIds: Object.freeze(reactions.map((reaction) => reaction.id)),
            })
          : candidate,
      ),
    ),
  });
};
