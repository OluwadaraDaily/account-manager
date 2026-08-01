import { z } from "zod";

const timestampSchema = z.coerce.number().int().nonnegative();

export const importMessagesQuerySchema = z
  .object({
    pageToken: z.string().min(1).max(500).optional(),
    senderEmail: z.string().email().optional(),
    after: timestampSchema.optional(),
    before: timestampSchema.optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    keyword: z.string().trim().min(1).max(200).optional(),
  })
  .refine(({ after, before }) => after === undefined || before === undefined || before > after, {
    message: "before must be later than after.",
    path: ["before"],
  });

export type ImportMessagesQuery = z.infer<typeof importMessagesQuerySchema>;
