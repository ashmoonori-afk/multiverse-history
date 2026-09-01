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
  /** Every nation that must answer, in event order — ONE provider call total. */
  readonly nations: readonly { readonly id: string; readonly nameKo: string }[];
  readonly eventJson: string;
  readonly contextJson: string;
}

export type CampaignReactionAuthor = (input: CampaignReactionAuthorInput) => Promise<unknown>;

/** Reaction output stays bounded (provider schema caps at 16 entries). */
const MAX_REACTING_NATIONS = 12;

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
  nations: readonly { readonly id: string; readonly nameKo: string }[],
): string =>
  canonicalStringify({
    campaign: {
      scenarioId: state.scenarioId,
      playerNationId: state.playerNationId,
      turn: event.turn,
      date: state.date,
    },
    reactingNations: nations,
    worldEvent: event,
  });

const BatchReactionOutputSchema = z.array(ReactionAuthorOutputSchema).min(1).max(16);

const normalizeBatchOutput = (
  output: unknown,
): readonly z.infer<typeof ReactionAuthorOutputSchema>[] => {
  if (Array.isArray(output)) {
    return BatchReactionOutputSchema.parse(output);
  }
  if (typeof output === "object" && output !== null && "reactions" in output) {
    return BatchReactionOutputSchema.parse((output as { reactions: unknown }).reactions);
  }
  throw new TypeError("PROVIDER_REACTION_OUTPUT_INVALID");
};

export const authorCampaignEventReactions = async (
  input: AuthorCampaignEventReactionsInput,
): Promise<readonly CampaignNationReaction[]> => {
  const reactingNationIds = input.event.affectedNationIds.slice(0, MAX_REACTING_NATIONS);
  const nations = reactingNationIds.map((nationId) => {
    const nation = input.state.nations.find((candidate) => candidate.id === nationId);
    if (nation === undefined) {
      throw new RangeError("REACTION_NATION_INVALID");
    }
    return Object.freeze({ id: nation.id, nameKo: nation.nameKo });
  });
  const output = normalizeBatchOutput(
    await input.reactionAuthor({
      nations,
      eventJson: canonicalStringify(input.event),
      contextJson: reactionContext(input.state, input.event, nations),
    }),
  );
  const byNationId = new Map(output.map((reaction) => [reaction.nationId, reaction]));
  return Object.freeze(
    reactingNationIds.map((nationId) => {
      const reaction = byNationId.get(nationId);
      if (reaction === undefined) {
        throw new TypeError("PROVIDER_REACTION_NATION_MISMATCH");
      }
      return CampaignNationReactionSchema.parse({
        id: `rct_${input.event.id}_${nationId}`,
        worldEventId: input.event.id,
        ...reaction,
      });
    }),
  );
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
