import { parseNewsOutput } from "../providers/news-schema";
import type { StrategicPlan } from "../providers/schemas";
import { canonicalStringify } from "../shared/canonical-json";
import { type CampaignNewsArticle, campaignNewsArticleBody } from "./campaign-news-article";
import type { CampaignState } from "./campaign-state";

export interface CampaignNewsAuthorInput {
  readonly orderText: string;
  readonly contextJson: string;
  readonly deterministicArticle: CampaignNewsArticle;
}

export type CampaignNewsAuthor = (input: CampaignNewsAuthorInput) => Promise<unknown>;

export interface FinalizeCampaignNewsInput {
  readonly before: CampaignState;
  readonly reduced: CampaignState;
  readonly plan: StrategicPlan;
  readonly orderText: string;
  readonly author: CampaignNewsAuthor;
}

const newsContext = (input: FinalizeCampaignNewsInput, resolutionIndex: number): string => {
  const resolution = input.reduced.resolutions[resolutionIndex];
  if (resolution === undefined) {
    throw new RangeError("CAMPAIGN_RESOLUTION_MISSING");
  }
  const affectedNationIds = new Set(resolution.worldImpact.changedNationIds);
  return canonicalStringify({
    campaign: {
      scenarioId: input.reduced.scenarioId,
      playerNationId: input.reduced.playerNationId,
      turn: resolution.turn,
      date: input.reduced.date,
      elapsedDays: input.reduced.elapsedDays,
    },
    nations: input.reduced.nations
      .filter((nation) => affectedNationIds.has(nation.id))
      .map((nation) => ({
        id: nation.id,
        nameKo: nation.nameKo,
        capitalLabelKo: nation.capitalLabelKo,
      })),
    resolution: {
      id: resolution.id,
      cadence: resolution.cadence,
      advanceDays: resolution.advanceDays,
      nationDeltas: resolution.nationDeltas,
      relationDeltas: resolution.relationDeltas,
      treatyDeltas: resolution.treatyDeltas,
      worldImpact: resolution.worldImpact,
      constructionProjects: input.reduced.constructionProjects.filter(
        (project) => project.startedTurn === resolution.turn,
      ),
      worldEvents: resolution.worldEventIds.map((eventId) =>
        input.reduced.worldEvents.find((event) => event.id === eventId),
      ),
      nationReactions: resolution.reactionIds.map((reactionId) =>
        input.reduced.nationReactions.find((reaction) => reaction.id === reactionId),
      ),
    },
    planFacts: {
      playerIntentTypes: input.plan.playerIntents.map((intent) => intent.type),
      npcIntentTypes: input.plan.npcIntents.map((intent) => intent.type),
      warnings: input.plan.warnings,
    },
  });
};

export const finalizeCampaignNews = async (
  input: FinalizeCampaignNewsInput,
): Promise<CampaignState> => {
  const resolutionIndex = input.reduced.resolutions.length - 1;
  const resolution = input.reduced.resolutions[resolutionIndex];
  if (resolution === undefined) {
    throw new RangeError("CAMPAIGN_RESOLUTION_MISSING");
  }
  const article = parseNewsOutput(
    await input.author({
      orderText: input.orderText,
      contextJson: newsContext(input, resolutionIndex),
      deterministicArticle: resolution.article,
    }),
    input.orderText,
  );
  const finalizedResolution = Object.freeze({
    ...resolution,
    article,
    articleKo: campaignNewsArticleBody(article),
  });
  return Object.freeze({
    ...input.reduced,
    resolutions: Object.freeze(
      input.reduced.resolutions.map((candidate, index) =>
        index === resolutionIndex ? finalizedResolution : candidate,
      ),
    ),
  });
};
