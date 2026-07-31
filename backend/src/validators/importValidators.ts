import { z } from "zod";

export const importMessagesQuerySchema = z.object({
  pageToken: z.string().min(1).optional(),
});

export type ImportMessagesQuery = z.infer<typeof importMessagesQuerySchema>;
