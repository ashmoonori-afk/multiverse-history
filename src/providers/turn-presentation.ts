import { z } from "zod";

import { type NewsOutput, newsJsonSchema, parseNewsOutput } from "./news-schema";
import { parseReactionOutput, type ReactionOutput } from "./reaction-schema";

export interface TurnPresentation {
  readonly article: NewsOutput;
  readonly reactions: ReactionOutput["reactions"];
}

const WirePresentationSchema = z
  .object({
    article: z.unknown(),
    reactions: z.unknown(),
  })
  .strict();

export const parseTurnPresentation = (value: unknown): TurnPresentation => {
  const wire = WirePresentationSchema.parse(value);
  return Object.freeze({
    article: parseNewsOutput(wire.article, ""),
    reactions: parseReactionOutput({ reactions: wire.reactions }).reactions,
  });
};

export const turnPresentationJsonSchema = (): object => ({
  type: "object",
  properties: {
    article: newsJsonSchema(),
    reactions: {
      type: "array",
      minItems: 1,
      maxItems: 16,
      items: {
        type: "object",
        properties: {
          nationId: { type: "string", pattern: "^nat_[a-z0-9_]+$" },
          stance: {
            type: "string",
            enum: ["supportive", "cautious", "opposed", "neutral"],
          },
          sentimentBps: { type: "integer", minimum: -10_000, maximum: 10_000 },
          statementKo: { type: "string", minLength: 1, maxLength: 1_200 },
        },
        required: ["nationId", "stance", "sentimentBps", "statementKo"],
        additionalProperties: false,
      },
    },
  },
  required: ["article", "reactions"],
  additionalProperties: false,
});
