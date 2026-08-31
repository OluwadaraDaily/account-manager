import { z } from "zod";

export const groupingBankQuerySchema = z.object({
  bankId: z.string().trim().min(1).max(100),
});

export const createTransactionGroupBodySchema = z.object({
  bankId: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(80),
});

export const renameTransactionGroupBodySchema = createTransactionGroupBodySchema;
export const assignTransactionGroupBodySchema = groupingBankQuerySchema;
