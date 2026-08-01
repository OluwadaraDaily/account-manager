import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export type ValidatedLocals<T extends z.ZodType> = {
  validatedQuery: z.infer<T>;
  validatedBody: z.infer<T>;
};

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (
    request: Request,
    response: Response<unknown, ValidatedLocals<T>>,
    next: NextFunction,
  ) => {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      response.status(400).json({ error: "Invalid request query." });
      return;
    }

    response.locals.validatedQuery = result.data;
    next();
  };
}

export function validateBody<T extends z.ZodType>(schema: T) {
  return (
    request: Request,
    response: Response<unknown, ValidatedLocals<T>>,
    next: NextFunction,
  ) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({ error: "Invalid request body." });
      return;
    }

    response.locals.validatedBody = result.data;
    next();
  };
}
