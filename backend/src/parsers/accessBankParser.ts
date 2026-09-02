import type { NormalizedTransaction } from "@account-manager/shared";
import type { GmailMessageContent } from "../integrations/google/gmailClient.js";

function nextValue(lines: string[], label: string) {
  const index = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
  return index === -1 ? null : (lines.slice(index + 1).find(Boolean) ?? null);
}

function parseDate(value: string | null) {
  const match = value?.match(/^(\d{1,2})-([A-Za-z]{3,9})-(\d{4})$/);
  if (!match) return null;

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
    ].findIndex((name) => name.startsWith(match[2].toLowerCase())) + 1;
  if (!month) return null;

  const date = new Date(Date.UTC(Number(match[3]), month - 1, Number(match[1])));
  return date.getUTCFullYear() === Number(match[3]) && date.getUTCMonth() === month - 1
    ? date.toISOString().slice(0, 10)
    : null;
}

function fallbackMessageDate(message: GmailMessageContent) {
  if (message.internalDate && Number.isFinite(Number(message.internalDate))) {
    return new Date(Number(message.internalDate)).toISOString().slice(0, 10);
  }
  if (message.headers.date) {
    const date = new Date(message.headers.date);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return null;
}

export function parseAccessBankTransaction(
  message: GmailMessageContent,
): NormalizedTransaction | null {
  const bodyText = message.body.text ?? "";
  const subject = message.headers.subject ?? "";
  const from = message.headers.from ?? "";
  const searchableText = `${from}\n${subject}\n${bodyText}`;
  if (
    !/no_reply@accessbankplc\.com/i.test(from) ||
    !/accessalert|access bank/i.test(searchableText)
  ) {
    return null;
  }

  const lines = bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const subjectDirection = subject.match(/\[(Debit|Credit):/i)?.[1]?.toLowerCase();
  const bodyDirectionMatch = searchableText
    .match(/account has been (Debited|Credited)/i)?.[1]
    ?.toLowerCase();
  const bodyDirection = bodyDirectionMatch?.startsWith("debit")
    ? "debit"
    : bodyDirectionMatch?.startsWith("credit")
      ? "credit"
      : undefined;
  const direction =
    subjectDirection === bodyDirection ? (subjectDirection as "debit" | "credit") : null;
  const amountSource =
    subject.match(/\[(?:Debit|Credit):\s*(?:NGN|₦)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:NGN)?/i)?.[1] ??
    bodyText.match(/(?:NGN|₦)\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1] ??
    null;
  const amount = amountSource?.replaceAll(",", "") ?? null;
  const description = nextValue(lines, "Description");
  const transactionDateValue = nextValue(lines, "Transaction Date");
  const transactionDate = parseDate(transactionDateValue) ?? fallbackMessageDate(message);
  const reviewReasons: string[] = [];

  if (!amount) reviewReasons.push("amount_missing");
  if (!direction) reviewReasons.push("direction_ambiguous");
  if (!parseDate(transactionDateValue))
    reviewReasons.push(transactionDate ? "date_fallback_used" : "date_missing");
  if (/\b(reversal|reversed|refund|chargeback|returned)\b/i.test(searchableText)) {
    reviewReasons.push("possible_reversal_or_refund");
  }

  const channel =
    description?.match(/\b(WEB|MOBILE|POS|ATM|USSD|INTERNET)\b/i)?.[1]?.toUpperCase() ?? null;
  const confidence =
    amount && direction && parseDate(transactionDateValue)
      ? "high"
      : amount && direction && transactionDate
        ? "medium"
        : "low";

  return {
    sourceMessageId: message.id,
    transactionDate,
    transactionTime: null,
    direction,
    amount,
    currency: amount ? "NGN" : null,
    counterparty: null,
    description: description ?? (subject || null),
    channel,
    confidence,
    reviewReasons,
    reviewStatus: confidence === "high" && reviewReasons.length === 0 ? "ready" : "needs-review",
  };
}
