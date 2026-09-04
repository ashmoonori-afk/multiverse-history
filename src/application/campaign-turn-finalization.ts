import type { StrategicPlan } from "../providers/schemas";
import { type CampaignNewsAuthor, finalizeCampaignNews } from "./campaign-news-finalization";
import type { CampaignState } from "./campaign-state";
import {
  type CampaignReactionAuthor,
  finalizeCampaignWorldFeedback,
} from "./campaign-world-feedback";
import type { CampaignWorldEventFactory } from "./world-event-engine";

export interface FinalizeCampaignTurnInput {
  readonly before: CampaignState;
  readonly reduced: CampaignState;
  readonly plan: StrategicPlan;
  readonly orderText: string;
  readonly eventFactory: CampaignWorldEventFactory;
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
  const [withFeedback, withNews] = await Promise.all([
    finalizeCampaignWorldFeedback({
      before: input.before,
      reduced: input.reduced,
      eventFactory: input.eventFactory,
      reactionAuthor,
    }),
    finalizeCampaignNews({
      before: input.before,
      reduced: input.reduced,
      plan: input.plan,
      orderText: input.orderText,
      author: newsAuthor,
    }),
  ]);
  const newsResolution = withNews.resolutions.at(-1);
  if (newsResolution === undefined) {
    throw new RangeError("CAMPAIGN_RESOLUTION_MISSING");
  }
  return Object.freeze({
    ...withFeedback,
    resolutions: Object.freeze(
      withFeedback.resolutions.map((resolution) =>
        resolution.id === newsResolution.id
          ? Object.freeze({
              ...resolution,
              article: newsResolution.article,
              articleKo: newsResolution.articleKo,
            })
          : resolution,
      ),
    ),
  });
};
