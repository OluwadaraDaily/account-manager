import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

function shouldRetryRequest(failureCount: number, error: unknown) {
  if (!(error instanceof ApiError)) return failureCount < 2;
  if (["unauthorized", "forbidden", "not_found", "conflict", "http"].includes(error.kind)) {
    return false;
  }

  return failureCount < 2;
}

function getRetryDelay(attemptIndex: number, error: unknown) {
  if (error instanceof ApiError && error.retryAfterSeconds !== null) {
    return error.retryAfterSeconds * 1000;
  }

  return Math.min(1000 * 2 ** attemptIndex, 30_000);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryRequest,
      retryDelay: getRetryDelay,
    },
    mutations: {
      retry: false,
    },
  },
});
