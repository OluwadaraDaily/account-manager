import axios, { AxiosError } from "axios";

const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN ?? "http://localhost:8787").replace(
  /\/$/,
  "",
);

export type ApiErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "server"
  | "network"
  | "http"
  | "unknown";

export class ApiError extends Error {
  readonly status: number | null;
  readonly kind: ApiErrorKind;
  readonly retryAfterSeconds: number | null;

  constructor({
    message,
    status,
    kind,
    retryAfterSeconds = null,
    cause,
  }: {
    message: string;
    status: number | null;
    kind: ApiErrorKind;
    retryAfterSeconds?: number | null;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getErrorMessage(data: unknown) {
  if (typeof data === "object" && data !== null && "error" in data) {
    const message = data.error;
    if (typeof message === "string" && message.trim()) return message;
  }

  return undefined;
}

function getErrorKind(status: number | null): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status !== null && status >= 500) return "server";
  if (status !== null) return "http";
  return "network";
}

function getRetryAfterSeconds(error: AxiosError) {
  const retryAfter = error.response?.headers["retry-after"];
  const value = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
  const seconds = typeof value === "string" ? Number(value) : value;

  return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    return new ApiError({
      message:
        getErrorMessage(error.response?.data) ??
        (status === null ? "The backend could not be reached." : "The backend request failed."),
      status,
      kind: getErrorKind(status),
      retryAfterSeconds: getRetryAfterSeconds(error),
      cause: error,
    });
  }

  return new ApiError({
    message: error instanceof Error ? error.message : "An unexpected API error occurred.",
    status: null,
    kind: "unknown",
    cause: error,
  });
}

export const apiClient = axios.create({
  baseURL: backendOrigin,
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normalizeApiError(error)),
);
