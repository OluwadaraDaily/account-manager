import { z } from "zod";

const timestampSchema = z.coerce.number().int().nonnegative();

const gmailSearchCriteriaObjectSchema = z.object({
  senderEmail: z.string().email().optional(),
  after: timestampSchema.optional(),
  before: timestampSchema.optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  keyword: z.string().trim().min(1).max(200).optional(),
});

const validDateRange = ({ after, before }: { after?: number; before?: number }) =>
  after === undefined || before === undefined || before > after;

const dateRangeError = {
  message: "before must be later than after.",
  path: ["before"],
};

export const importMessagesQuerySchema = gmailSearchCriteriaObjectSchema
  .extend({ pageToken: z.string().min(1).max(500).optional() })
  .refine(validDateRange, dateRangeError);

export type ImportMessagesQuery = z.infer<typeof importMessagesQuerySchema>;

export const createImportJobBodySchema = gmailSearchCriteriaObjectSchema
  .extend({ bankId: z.string().trim().min(1).max(100) })
  .refine(validDateRange, dateRangeError);

export type CreateImportJobBody = z.infer<typeof createImportJobBodySchema>;

export const importMessageMetadataBodySchema = z.object({
  messageIds: z.array(z.string().min(1).max(200)).min(1).max(100),
});

export type ImportMessageMetadataBody = z.infer<typeof importMessageMetadataBodySchema>;
