import { z } from "zod";

const NationIdSchema = z.string().regex(/^nat_[a-z0-9_]+$/);

const GroupChatReplySchema = z
  .object({
    speakerNationId: NationIdSchema,
    textKo: z.string().trim().min(1).max(1_200),
  })
  .strict()
  .readonly();

const GroupChatOutputSchema = z
  .object({
    replies: z.array(GroupChatReplySchema).min(1).max(8).readonly(),
  })
  .strict()
  .readonly();

export type GroupChatOutput = z.infer<typeof GroupChatOutputSchema>;

export const parseGroupChatOutput = (value: unknown): GroupChatOutput =>
  GroupChatOutputSchema.parse(value);

export const groupChatJsonSchema = (): object => ({
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    replies: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          speakerNationId: { type: "string", pattern: "^nat_[a-z0-9_]+$" },
          textKo: { type: "string", minLength: 1, maxLength: 1_200 },
        },
        required: ["speakerNationId", "textKo"],
        additionalProperties: false,
      },
    },
  },
  required: ["replies"],
  additionalProperties: false,
});
