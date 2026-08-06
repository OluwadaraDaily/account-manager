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

export const importTransactionsQuerySchema = z.object({
  bankId: z.string().trim().min(1).max(100),
});

export type ImportTransactionsQuery = z.infer<typeof importTransactionsQuerySchema>;

export const updateImportedTransactionBodySchema = z
  .object({
    bankId: z.string().trim().min(1).max(100),
    direction: z.enum(["debit", "credit"]).optional(),
    transactionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "transactionDate must use YYYY-MM-DD format.")
      .nullable()
      .optional(),
    amount: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, "amount must be a positive number with up to two decimals.")
      .nullable()
      .optional(),
    counterparty: z.string().trim().max(200).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    reviewStatus: z.literal("dismissed").optional(),
  })
  .refine(
    (body) =>
      body.direction !== undefined ||
      body.transactionDate !== undefined ||
      body.amount !== undefined ||
      body.counterparty !== undefined ||
      body.description !== undefined ||
      body.reviewStatus !== undefined,
    { message: "At least one transaction field must be provided." },
  );

export type UpdateImportedTransactionBody = z.infer<typeof updateImportedTransactionBodySchema>;

export const createImportJobBodySchema = gmailSearchCriteriaObjectSchema
  .extend({
    bankId: z.string().trim().min(1).max(100),
    searchMode: z.enum(["sender", "bank-fallback"]).optional().default("sender"),
  })
  .refine(validDateRange, dateRangeError);

export type CreateImportJobBody = z.infer<typeof createImportJobBodySchema>;

export const importMessageMetadataBodySchema = z.object({
  messageIds: z.array(z.string().min(1).max(200)).min(1).max(100),
});

export type ImportMessageMetadataBody = z.infer<typeof importMessageMetadataBodySchema>;
