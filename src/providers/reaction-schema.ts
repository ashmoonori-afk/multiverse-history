import { z } from "zod";

const ReactionSchema = z
  .object({
    nationId: z.string().regex(/^nat_[a-z0-9_]+$/),
    stance: z.enum(["supportive", "cautious", "opposed", "neutral"]),
    sentimentBps: z.number().safe().int().min(-10_000).max(10_000),
    statementKo: z.string().trim().min(1).max(1_200),
  })
  .strict()
  .readonly();

const ReactionOutputSchema = z
  .object({
    reactions: z.array(ReactionSchema).min(1).max(16).readonly(),
  })
  .strict()
  .readonly();

export type ReactionOutput = z.infer<typeof ReactionOutputSchema>;

export const parseReactionOutput = (value: unknown): ReactionOutput =>
  ReactionOutputSchema.parse(value);

export const reactionJsonSchema = (): object => ({
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
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
  required: ["reactions"],
  additionalProperties: false,
});
