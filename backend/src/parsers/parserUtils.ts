import type { NormalizedTransaction } from "@account-manager/shared";
import type { GmailMessageContent } from "../integrations/google/gmailClient.js";

function toIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}

export function parseDateValue(value: string | null) {
  if (!value) return null;
  const isoMatch = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  const numericMatch = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numericMatch) {
    const year =
      Number(numericMatch[3]) < 100 ? 2000 + Number(numericMatch[3]) : Number(numericMatch[3]);
    return toIsoDate(year, Number(numericMatch[2]), Number(numericMatch[1]));
  }

  const monthMatch = value.match(/\b(\d{1,2})[ -]([A-Za-z]{3,9})[ -](\d{4})\b/);
  if (monthMatch) {
    const month =
      [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ].findIndex((name) => name.startsWith(monthMatch[2].toLowerCase())) + 1;
    return month ? toIsoDate(Number(monthMatch[3]), month, Number(monthMatch[1])) : null;
  }

  const namedDate = new Date(value);
  return Number.isNaN(namedDate.getTime()) ? null : namedDate.toISOString().slice(0, 10);
}

export function parseTimeValue(value: string | null) {
  if (!value) return null;
  const timeMatch = value.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\b/i);
  if (!timeMatch) return null;
  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3] ?? "0");
  const meridiem = timeMatch[4]?.toUpperCase();
  if (minutes > 59 || seconds > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM" && hours === 12) hours = 0;
    if (meridiem === "PM" && hours !== 12) hours += 12;
  } else if (hours > 23) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function fallbackMessageDate(message: GmailMessageContent) {
  if (message.internalDate && Number.isFinite(Number(message.internalDate))) {
    return new Date(Number(message.internalDate)).toISOString().slice(0, 10);
  }
  if (message.headers.date) {
    const date = new Date(message.headers.date);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return null;
}

export function normalizeAmount(value: string | null) {
  const amount = value?.match(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/);
  return amount ? amount[0].replaceAll(",", "") : null;
}

export function assessTransaction(input: {
  amount: string | null;
  direction: NormalizedTransaction["direction"];
  parsedTransactionDate: string | null;
  transactionDate: string | null;
  reviewReasons: string[];
}) {
  if (!input.amount) input.reviewReasons.push("amount_missing");
  if (!input.direction) input.reviewReasons.push("direction_ambiguous");
  if (!input.parsedTransactionDate) {
    input.reviewReasons.push(input.transactionDate ? "date_fallback_used" : "date_missing");
  }
  const confidence: NormalizedTransaction["confidence"] =
    input.amount && input.direction && input.parsedTransactionDate
      ? "high"
      : input.amount && input.direction && input.transactionDate
        ? "medium"
        : "low";
  const reviewStatus: NormalizedTransaction["reviewStatus"] =
    confidence === "high" && input.reviewReasons.length === 0 ? "ready" : "needs-review";
  return { confidence, reviewStatus };
}
