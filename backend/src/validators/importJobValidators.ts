import { z } from "zod";

export const importJobsQuerySchema = z.object({
  bankId: z.string().trim().min(1).max(100),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type ImportJobsQuery = z.infer<typeof importJobsQuerySchema>;
