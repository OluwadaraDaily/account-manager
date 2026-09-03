import { z } from "zod";

export const importTransactionsQuerySchema = z.object({
  bankId: z.string().trim().min(1).max(100),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
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
    transactionTime: z
      .string()
      .regex(/^\d{2}:\d{2}:\d{2}$/, "transactionTime must use HH:mm:ss format.")
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
      body.transactionTime !== undefined ||
      body.amount !== undefined ||
      body.counterparty !== undefined ||
      body.description !== undefined ||
      body.reviewStatus !== undefined,
    { message: "At least one transaction field must be provided." },
  );

export type UpdateImportedTransactionBody = z.infer<typeof updateImportedTransactionBodySchema>;
