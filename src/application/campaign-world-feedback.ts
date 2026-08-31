import { z } from "zod";

import { canonicalStringify } from "../shared/canonical-json";
import { type CampaignNationReaction, CampaignNationReactionSchema } from "./campaign-reaction";
import type { CampaignResolution } from "./campaign-resolution";
import type { CampaignState } from "./campaign-state";
import { type CampaignWorldEvent, CampaignWorldEventSchema } from "./campaign-world-event";
import type { CampaignWorldEventFactory } from "./world-event-engine";

const ReactionAuthorOutputSchema = z
  .object({
    nationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    stance: z.enum(["supportive", "cautious", "opposed", "neutral"]),
    sentimentBps: z.number().safe().int().min(-10_000).max(10_000),
    statementKo: z.string().min(1).max(1_200),
  })
  .strict();

export interface CampaignReactionAuthorInput {
  readonly nationId: string;
  readonly nationNameKo: string;
  readonly eventJson: string;
  readonly contextJson: string;
}

export type CampaignReactionAuthor = (input: CampaignReactionAuthorInput) => Promise<unknown>;

export interface FinalizeCampaignWorldFeedbackInput {
  readonly before: CampaignState;
  readonly reduced: CampaignState;
  readonly eventFactory: CampaignWorldEventFactory;
  readonly reactionAuthor: CampaignReactionAuthor;
}

export interface AuthorCampaignEventReactionsInput {
  readonly state: CampaignState;
  readonly event: CampaignWorldEvent;
  readonly reactionAuthor: CampaignReactionAuthor;
}

const latestResolution = (state: CampaignState): CampaignResolution => {
  const resolution = state.resolutions.at(-1);
  if (resolution === undefined) {
    throw new RangeError("CAMPAIGN_RESOLUTION_MISSING");
  }
  return resolution;
};

const reactionContext = (
  state: CampaignState,
  event: CampaignWorldEvent,
  nationId: string,
): string => {
  const nation = state.nations.find((candidate) => candidate.id === nationId);
  if (nation === undefined) {
    throw new RangeError("REACTION_NATION_INVALID");
  }
  return canonicalStringify({
    campaign: {
      scenarioId: state.scenarioId,
      playerNationId: state.playerNationId,
      turn: event.turn,
      date: state.date,
    },
    reactingNation: {
      id: nation.id,
      nameKo: nation.nameKo,
      capitalLabelKo: nation.capitalLabelKo,
    },
    worldEvent: event,
  });
};

export const authorCampaignEventReactions = async (
  input: AuthorCampaignEventReactionsInput,
): Promise<readonly CampaignNationReaction[]> => {
  const eventJson = canonicalStringify(input.event);
  const reactions: CampaignNationReaction[] = [];
  for (const nationId of input.event.affectedNationIds) {
    const nation = input.state.nations.find((candidate) => candidate.id === nationId);
    if (nation === undefined) {
      throw new RangeError("REACTION_NATION_INVALID");
    }
    const output = ReactionAuthorOutputSchema.parse(
      await input.reactionAuthor({
        nationId,
        nationNameKo: nation.nameKo,
        eventJson,
        contextJson: reactionContext(input.state, input.event, nationId),
      }),
    );
    if (output.nationId !== nationId) {
      throw new TypeError("PROVIDER_REACTION_NATION_MISMATCH");
    }
    reactions.push(
      CampaignNationReactionSchema.parse({
        id: `rct_${input.event.id}_${nationId}`,
        worldEventId: input.event.id,
        ...output,
      }),
    );
  }
  return Object.freeze(reactions);
};

export const finalizeCampaignWorldFeedback = async (
  input: FinalizeCampaignWorldFeedbackInput,
): Promise<CampaignState> => {
  const resolution = latestResolution(input.reduced);
  const event = CampaignWorldEventSchema.parse(
    input.eventFactory({
      before: input.before,
      reduced: input.reduced,
      resolution,
    }),
  );
  const reactions = await authorCampaignEventReactions({
    state: input.reduced,
    event,
    reactionAuthor: input.reactionAuthor,
  });
  const changedNationIds = Object.freeze([
    ...new Set([...resolution.worldImpact.changedNationIds, ...event.affectedNationIds]),
  ]);
  const finalizedResolution = Object.freeze({
    ...resolution,
    worldEventIds: Object.freeze([event.id]),
    reactionIds: Object.freeze(reactions.map((reaction) => reaction.id)),
    worldImpact: Object.freeze({
      ...resolution.worldImpact,
      changedNationIds,
    }),
  });
  return Object.freeze({
    ...input.reduced,
    worldEvents: Object.freeze([...input.reduced.worldEvents, event]),
    nationReactions: Object.freeze([...input.reduced.nationReactions, ...reactions]),
    resolutions: Object.freeze(
      input.reduced.resolutions.map((candidate) =>
        candidate.id === resolution.id ? finalizedResolution : candidate,
      ),
    ),
  });
};
