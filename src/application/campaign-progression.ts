import { z } from "zod";

export const TimelineProgressionResultSchema = z
  .object({
    mode: z.enum(["months", "until_major_event"]),
    advanceDays: z.number().safe().int().nonnegative().max(548),
    steps: z.number().safe().int().nonnegative().max(24),
    stopReason: z.enum(["requested_duration", "major_event", "horizon_reached"]),
    majorEventId: z
      .string()
      .regex(/^evt_[a-z0-9_]+$/)
      .optional(),
  })
  .strict()
  .readonly();

export type TimelineProgressionResult = z.infer<typeof TimelineProgressionResultSchema>;
